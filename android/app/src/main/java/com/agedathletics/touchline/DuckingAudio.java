package com.agedathletics.touchline;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaMetadataRetriever;
import android.media.MediaPlayer;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Locale;
import java.util.UUID;
import java.util.function.Consumer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

/** Transient focus ducks other media only during cues and short gaps between them. */
final class DuckingAudio {
    private static final long DUCK_LEAD_MS = 500;
    private static final class Clip {
        final String file; final double duration;
        Clip(String file,double duration){this.file=file;this.duration=duration;}
    }
    private static final class Entry {
        final String group; Runnable start,cutoff; MediaPlayer player; String utteranceId;
        Entry(String group){this.group=group;}
    }
    private final Context context;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Consumer<String> onError;
    private final AudioManager manager;
    private final AudioAttributes attributes;
    private final AudioFocusRequest focusRequest;
    private TextToSpeech speech;
    private volatile boolean speechReady;
    private volatile Map<String,Clip> clips = Collections.emptyMap();
    private final Map<UUID,Entry> entries = new HashMap<>();
    private boolean focused;
    private long primedUntil;
    private final Runnable release = this::abandonFocus;

    DuckingAudio(Context context,Consumer<String> onError) {
        this.context=context;this.onError=onError;
        manager=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE);
        attributes=new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
        focusRequest=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(attributes).setAcceptsDelayedFocusGain(false).setWillPauseWhenDucked(true)
            .setOnAudioFocusChangeListener(change->{if(change<0)stop();},handler).build();
        speech=new TextToSpeech(context,status->handler.post(()->configureSpeech(status)));
    }
    private void configureSpeech(int status) {
        if(status!=TextToSpeech.SUCCESS||speech==null)return;
        speechReady=true;speech.setLanguage(Locale.UK);speech.setAudioAttributes(attributes);
        speech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) {}
            @Override public void onDone(String id) {handler.post(()->finishSpeech(id));}
            @Override public void onError(String id) {handler.post(()->{onError.accept("Unable to speak the team callout.");finishSpeech(id);});}
        });
    }

    // Called on the bridge thread; publish the complete catalog atomically.
    synchronized JSONObject prepare() throws Exception {
        if (clips.isEmpty()) {
            JSONObject files;
            try (java.io.InputStream stream=context.getAssets().open("audio-catalog.json")) {
                java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();
                byte[] buffer=new byte[4096];int length;
                while((length=stream.read(buffer))!=-1)bytes.write(buffer,0,length);
                files=new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));
            }
            Map<String,Clip> loaded = new HashMap<>();
            Iterator<String> keys=files.keys();
            while(keys.hasNext()) {
                String key=keys.next(), file="audio/"+files.getString(key);
                MediaMetadataRetriever metadata=new MediaMetadataRetriever();
                try (AssetFileDescriptor descriptor=context.getAssets().openFd(file)) {
                    metadata.setDataSource(descriptor.getFileDescriptor(),descriptor.getStartOffset(),descriptor.getLength());
                    double duration=Double.parseDouble(metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION))/1000.0;
                    if(!Double.isFinite(duration)||duration<=0)throw new IllegalStateException("Invalid clip: "+key);
                    loaded.put(key,new Clip(file,duration));
                } finally { metadata.release(); }
            }
            clips=Collections.unmodifiableMap(loaded);
            android.util.Log.i("Touchline","Prepared " + clips.size() + " native audio clips");
        }
        JSONObject durations=new JSONObject();
        for(Map.Entry<String,Clip> entry:clips.entrySet())durations.put(entry.getKey(),entry.getValue().duration);
        return durations;
    }

    // All playback operations execute on the Activity's main thread.
    void handle(JSONObject command) throws Exception {
        String action=command.getString("action");
        switch(action) {
            case "prime": prime();break;
            case "play":
                Clip clip=clips.get(command.getString("name"));
                String group=command.getString("group");
                double delay=command.getDouble("at"),duration=command.getDouble("duration"),volume=command.getDouble("volume");
                if(clip==null || !validGroup(group) || !inRange(delay,0,60) || !inRange(duration,0.001,120) || !inRange(volume,0,1))
                    throw new IllegalArgumentException("Invalid audio command");
                schedule(clip,group,delay,Math.min(duration,clip.duration),(float)volume);break;
            case "speak":
                String text=command.getString("text");double speechDelay=command.getDouble("at"),rate=command.getDouble("rate");
                if(text.trim().isEmpty()||text.length()>240||!inRange(speechDelay,0,60)||!inRange(rate,0.7,1.3))throw new IllegalArgumentException("Invalid speech command");
                scheduleSpeech(text,speechDelay,(float)rate);break;
            case "stopGroup":
                String selected=command.getString("group");
                if(!validGroup(selected))throw new IllegalArgumentException("Invalid audio group");
                for(UUID id:new ArrayList<>(entries.keySet()))if(entries.get(id).group.equals(selected))remove(id);
                releaseIfIdle();break;
            case "stop": stop();break;
            default: throw new IllegalArgumentException("Unknown audio command");
        }
    }
    private static boolean validGroup(String group) {
        return group.equals("voice")||group.equals("whistle")||group.equals("crowd")||group.equals("effect");
    }
    private static boolean inRange(double n,double min,double max){return Double.isFinite(n)&&n>=min&&n<=max;}

    private void acquireFocus() {
        if(focused)return;
        if(manager.requestAudioFocus(focusRequest)!=AudioManager.AUDIOFOCUS_REQUEST_GRANTED)
            throw new IllegalStateException("Audio focus unavailable. Close other voice or call apps and try again.");
        focused=true;
        android.util.Log.d("Touchline","Audio focus acquired (transient may duck)");
    }
    private void prime() {
        handler.removeCallbacks(release);acquireFocus();
        primedUntil=SystemClock.uptimeMillis()+1000;
        handler.postDelayed(release,1100);
    }

    private void schedule(Clip clip,String group,double delay,double duration,float volume) {
        UUID id=UUID.randomUUID();Entry entry=new Entry(group);
        long lead=SystemClock.uptimeMillis()<primedUntil?0:DUCK_LEAD_MS;
        handler.removeCallbacks(release);
        acquireFocus();
        entry.start=()->{
            if(!entries.containsKey(id))return;
            try {
                MediaPlayer player=new MediaPlayer();entry.player=player;
                player.setAudioAttributes(attributes);
                try(AssetFileDescriptor descriptor=context.getAssets().openFd(clip.file)) {
                    player.setDataSource(descriptor.getFileDescriptor(),descriptor.getStartOffset(),descriptor.getLength());
                }
                player.setVolume(volume,volume);
                player.setOnCompletionListener(ignored->finish(id));
                player.setOnErrorListener((ignored,what,extra)->{onError.accept("Audio unavailable. Check your device audio output.");finish(id);return true;});
                player.prepare(); player.start();
                // A single recording supplies the short/long referee whistle segments.
                if(duration<clip.duration-0.01) {
                    entry.cutoff=()->finish(id);handler.postDelayed(entry.cutoff,Math.round(duration*1000));
                }
            } catch(Exception error) {
                onError.accept(error.getMessage()==null?"Unable to play this audio cue.":error.getMessage());finish(id);
            }
        };
        entries.put(id,entry);handler.postDelayed(entry.start,Math.round(delay*1000)+lead);
    }
    private void scheduleSpeech(String text,double delay,float rate) {
        if(!speechReady)throw new IllegalStateException("Device speech is not ready yet.");
        UUID id=UUID.randomUUID();Entry entry=new Entry("voice");entry.utteranceId=id.toString();
        long lead=SystemClock.uptimeMillis()<primedUntil?0:DUCK_LEAD_MS;
        handler.removeCallbacks(release);acquireFocus();
        entry.start=()->{
            if(!entries.containsKey(id))return;
            speech.setSpeechRate(rate);
            Bundle options=new Bundle();options.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME,1f);
            if(speech.speak(text,TextToSpeech.QUEUE_FLUSH,options,entry.utteranceId)==TextToSpeech.ERROR){onError.accept("Unable to speak the team callout.");finish(id);}
        };
        entries.put(id,entry);handler.postDelayed(entry.start,Math.round(delay*1000)+lead);
    }
    private void finishSpeech(String utteranceId) {
        for(Map.Entry<UUID,Entry> item:new ArrayList<>(entries.entrySet()))if(utteranceId.equals(item.getValue().utteranceId)){finish(item.getKey());return;}
    }
    private void remove(UUID id) {
        Entry entry=entries.remove(id);if(entry==null)return;
        handler.removeCallbacks(entry.start);
        if(entry.cutoff!=null)handler.removeCallbacks(entry.cutoff);
        if(entry.player!=null){entry.player.setOnCompletionListener(null);entry.player.setOnErrorListener(null);entry.player.release();}
        if(entry.utteranceId!=null)speech.stop();
    }
    private void finish(UUID id){remove(id);releaseIfIdle();}
    private void releaseIfIdle() {
        if(entries.isEmpty()&&focused){handler.removeCallbacks(release);handler.postDelayed(release,1100);}
    }
    private void abandonFocus() {
        if(entries.isEmpty()&&focused){manager.abandonAudioFocusRequest(focusRequest);focused=false;android.util.Log.d("Touchline","Audio focus released");}
    }
    void stop() {
        handler.removeCallbacks(release);
        primedUntil=0;
        for(UUID id:new ArrayList<>(entries.keySet()))remove(id);
        abandonFocus();
    }
    void shutdown() {stop();speechReady=false;if(speech!=null)speech.shutdown();}
}

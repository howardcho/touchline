package com.agedskaters.touchline;

import android.app.Activity;
import android.content.SharedPreferences;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import org.json.JSONObject;
import java.util.Collections;
import java.util.List;

/** Owns the permanent Google Play entitlement for three-to-five-team rotations. */
final class PremiumBilling implements PurchasesUpdatedListener {
    static final String PRODUCT_ID = "premium_unlock";
    interface Listener { void onChanged(); }

    private final Activity activity;
    private final Listener listener;
    private final SharedPreferences preferences;
    private BillingClient client;
    private ProductDetails details;
    private volatile boolean connected, ready, owned, pending;
    private volatile String price="$9.99", message="Connecting to Google Play…";

    PremiumBilling(Activity activity, Listener listener) {
        this.activity=activity;this.listener=listener;
        preferences=activity.getSharedPreferences("touchline-premium",Activity.MODE_PRIVATE);
        owned=preferences.getBoolean("owned",false) || (BuildConfig.DEBUG&&preferences.getBoolean("debug-owned",false));
    }

    void start() {
        if(client!=null)return;
        client=BillingClient.newBuilder(activity).setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) {
                if(result.getResponseCode()==BillingClient.BillingResponseCode.OK){connected=true;queryPurchases(false);queryDetails();}
                else {ready=true;message="Google Play purchases are unavailable right now.";changed();}
            }
            @Override public void onBillingServiceDisconnected(){connected=false;message="Reconnecting to Google Play…";changed();}
        });
    }

    JSONObject status() {
        JSONObject value=new JSONObject();
        try {
            value.put("enabled",true);value.put("ready",ready);value.put("unlocked",owned);
            value.put("pending",pending);value.put("price",price);value.put("testMode",BuildConfig.DEBUG);
            value.put("message",message);
        } catch(Exception ignored) { }
        return value;
    }

    void purchase() {
        if(owned){message="Premium is already unlocked.";changed();return;}
        if(!connected||details==null){message="Premium purchasing is available after this app is installed from Google Play.";changed();return;}
        List<ProductDetails.OneTimePurchaseOfferDetails> offers=details.getOneTimePurchaseOfferDetailsList();
        if(offers==null||offers.isEmpty()){message="The Premium purchase is not available yet.";changed();return;}
        BillingFlowParams.ProductDetailsParams product=BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(details).setOfferToken(offers.get(0).getOfferToken()).build();
        BillingResult result=client.launchBillingFlow(activity,BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(Collections.singletonList(product)).build());
        if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK){message="Google Play could not open the purchase. Please try again.";changed();}
    }

    void restore(){message="Checking your Google Play purchases…";changed();queryPurchases(true);}

    void debugUnlock() {
        if(!BuildConfig.DEBUG)return;
        preferences.edit().putBoolean("debug-owned",true).apply();owned=true;pending=false;
        message="Premium test unlock active.";changed();
    }

    void refresh(){if(connected)queryPurchases(false);}

    private void queryDetails() {
        QueryProductDetailsParams.Product product=QueryProductDetailsParams.Product.newBuilder()
            .setProductId(PRODUCT_ID).setProductType(BillingClient.ProductType.INAPP).build();
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(product)).build(),(result,queryResult)->{
                if(result.getResponseCode()==BillingClient.BillingResponseCode.OK&&!queryResult.getProductDetailsList().isEmpty()) {
                    details=queryResult.getProductDetailsList().get(0);
                    List<ProductDetails.OneTimePurchaseOfferDetails> offers=details.getOneTimePurchaseOfferDetailsList();
                    if(offers!=null&&!offers.isEmpty())price=offers.get(0).getFormattedPrice();
                    if(!owned&&!pending)message="";
                } else if(!owned)message="Premium purchasing is available after this app is installed from Google Play.";
                ready=true;changed();
            });
    }

    private void queryPurchases(boolean restoring) {
        if(!connected){ready=true;message="Google Play purchases are unavailable right now.";changed();return;}
        QueryPurchasesParams params=QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build();
        client.queryPurchasesAsync(params,(result,purchases)->{
            if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK){ready=true;message="Google Play could not check purchases right now.";changed();return;}
            boolean found=false,waiting=false;
            for(Purchase purchase:purchases)if(purchase.getProducts().contains(PRODUCT_ID)) {
                if(purchase.getPurchaseState()==Purchase.PurchaseState.PURCHASED){found=true;processPurchased(purchase);}
                else if(purchase.getPurchaseState()==Purchase.PurchaseState.PENDING)waiting=true;
            }
            pending=waiting;
            boolean debug=BuildConfig.DEBUG&&preferences.getBoolean("debug-owned",false);
            owned=found||debug;preferences.edit().putBoolean("owned",found).apply();ready=true;
            if(owned)message=debug&&!found?"Premium test unlock active.":"Premium unlocked.";
            else if(waiting)message="Purchase pending. Premium unlocks after Google Play confirms payment.";
            else if(restoring)message="No Premium purchase was found for this Google Play account.";
            changed();
        });
    }

    private void processPurchased(Purchase purchase) {
        owned=true;pending=false;preferences.edit().putBoolean("owned",true).apply();
        if(!purchase.isAcknowledged())client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.getPurchaseToken()).build(),result->{
                if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK)message="Premium is unlocked; Google Play acknowledgement will retry.";
                changed();
            });
    }

    @Override public void onPurchasesUpdated(BillingResult result,List<Purchase> purchases) {
        if(result.getResponseCode()==BillingClient.BillingResponseCode.OK&&purchases!=null) {
            for(Purchase purchase:purchases)if(purchase.getProducts().contains(PRODUCT_ID)) {
                if(purchase.getPurchaseState()==Purchase.PurchaseState.PURCHASED){processPurchased(purchase);message="Premium unlocked.";}
                else if(purchase.getPurchaseState()==Purchase.PurchaseState.PENDING){pending=true;message="Purchase pending. Premium unlocks after payment is confirmed.";}
            }
        } else if(result.getResponseCode()!=BillingClient.BillingResponseCode.USER_CANCELED)message="The purchase was not completed. Please try again.";
        changed();
    }

    private void changed(){activity.runOnUiThread(listener::onChanged);}
    void destroy(){if(client!=null){client.endConnection();client=null;}connected=false;}
}

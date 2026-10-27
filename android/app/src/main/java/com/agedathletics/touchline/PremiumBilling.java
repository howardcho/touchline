package com.agedathletics.touchline;

import android.app.Activity;
import android.content.SharedPreferences;
import android.util.Log;
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
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;
import com.android.billingclient.api.UnfetchedProduct;
import org.json.JSONObject;
import java.util.Collections;
import java.util.List;

/** Owns the permanent Google Play entitlement for three-to-five-team rotations. */
final class PremiumBilling implements PurchasesUpdatedListener {
    static final String PRODUCT_ID = "premium_unlock";
    private static final String TAG = "TouchlineBilling";
    interface Listener { void onChanged(); }

    private final Activity activity;
    private final Listener listener;
    private final SharedPreferences preferences;
    private BillingClient client;
    private ProductDetails details;
    private volatile boolean connected, connecting, detailsLoading, ready = BuildConfig.DEBUG;
    private volatile boolean owned, pending, purchaseRequested, restoreRequested;
    private volatile String price="$9.99", message=BuildConfig.DEBUG ? "" : "Connecting to Google Play…";

    PremiumBilling(Activity activity, Listener listener) {
        this.activity=activity;this.listener=listener;
        preferences=activity.getSharedPreferences("touchline-premium",Activity.MODE_PRIVATE);
        owned=preferences.getBoolean("owned",false) || (BuildConfig.DEBUG&&preferences.getBoolean("debug-owned",false));
    }

    void start() {
        if(client==null)client=BillingClient.newBuilder(activity).setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
        connect();
    }

    private void connect() {
        if(client==null||connecting)return;
        if(client.isReady()) { connected=true;onConnected();return; }
        connecting=true;connected=false;
        if(!BuildConfig.DEBUG)message="Connecting to Google Play…";
        changed();
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) {
                connecting=false;logResult("setup",result);
                if(result.getResponseCode()==BillingClient.BillingResponseCode.OK){connected=true;onConnected();}
                else {connected=false;ready=true;message=billingUnavailable(result);changed();}
            }
            @Override public void onBillingServiceDisconnected(){
                Log.w(TAG,"Google Play Billing service disconnected");
                connecting=false;connected=false;
                if(!BuildConfig.DEBUG)message="Reconnecting to Google Play…";
                changed();
            }
        });
    }

    private void onConnected() { queryPurchases(restoreRequested);queryDetails(); }

    JSONObject status() {
        JSONObject value=new JSONObject();
        try {
            value.put("enabled",true);value.put("ready",ready || BuildConfig.DEBUG);
            value.put("purchasable",BuildConfig.DEBUG || (connected&&details!=null&&offer()!=null));
            value.put("unlocked",owned);value.put("pending",pending);value.put("price",price);
            value.put("testMode",BuildConfig.DEBUG);value.put("message",message);
        } catch(Exception ignored) { }
        return value;
    }

    void purchase() {
        if(owned){message="Premium is already unlocked.";changed();return;}
        if(BuildConfig.DEBUG&&(!connected||details==null)){debugUnlock();return;}
        purchaseRequested=true;
        if(!connected){message="Connecting to Google Play…";changed();connect();return;}
        if(details==null){message="Loading the Premium purchase…";changed();queryDetails();return;}
        launchPurchase();
    }

    private void launchPurchase() {
        ProductDetails.OneTimePurchaseOfferDetails offer=offer();
        if(!connected||details==null||offer==null){message="The Premium purchase is not available yet.";changed();return;}
        purchaseRequested=false;
        BillingFlowParams.ProductDetailsParams product=BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(details).setOfferToken(offer.getOfferToken()).build();
        BillingResult result=client.launchBillingFlow(activity,BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(Collections.singletonList(product)).build());
        logResult("launch",result);
        if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK){
            if(BuildConfig.DEBUG){debugUnlock();return;}
            message=purchaseError(result);changed();
        }
    }

    void restore(){
        restoreRequested=true;message="Checking your Google Play purchases…";changed();
        if(!connected){connect();return;}
        queryPurchases(true);
    }

    void debugUnlock() {
        if(!BuildConfig.DEBUG)return;
        preferences.edit().putBoolean("debug-owned",true).apply();owned=true;pending=false;
        purchaseRequested=false;message="Premium test unlock active.";changed();
    }

    void refresh(){if(connected){queryPurchases(false);if(details==null)queryDetails();}else connect();}

    private ProductDetails.OneTimePurchaseOfferDetails offer() {
        if(details==null)return null;
        List<ProductDetails.OneTimePurchaseOfferDetails> offers=details.getOneTimePurchaseOfferDetailsList();
        return offers==null||offers.isEmpty()?null:offers.get(0);
    }

    private void queryDetails() {
        if(!connected||detailsLoading)return;
        detailsLoading=true;
        QueryProductDetailsParams.Product product=QueryProductDetailsParams.Product.newBuilder()
            .setProductId(PRODUCT_ID).setProductType(BillingClient.ProductType.INAPP).build();
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(product)).build(),this::onProductDetails);
    }

    private void onProductDetails(BillingResult result,QueryProductDetailsResult queryResult) {
        detailsLoading=false;ready=true;logResult("product details",result);
        List<ProductDetails> products=queryResult.getProductDetailsList();
        if(result.getResponseCode()==BillingClient.BillingResponseCode.OK&&!products.isEmpty()) {
            details=products.get(0);
            ProductDetails.OneTimePurchaseOfferDetails offer=offer();
            if(offer!=null){
                price=offer.getFormattedPrice();
                if(!owned&&!pending)message="";
                changed();
                if(purchaseRequested)launchPurchase();
                return;
            }
            message="Premium has no active purchase option in Google Play Console.";
        } else {
            details=null;
            List<UnfetchedProduct> unfetched=queryResult.getUnfetchedProductList();
            if(!unfetched.isEmpty()){
                UnfetchedProduct product=unfetched.get(0);
                Log.w(TAG,"Unfetched product "+product.getProductId()+" status="+product.getStatusCode());
                if(product.getStatusCode()==UnfetchedProduct.StatusCode.PRODUCT_NOT_FOUND)
                    message="Premium product “"+PRODUCT_ID+"” was not found for this Play app.";
                else if(product.getStatusCode()==UnfetchedProduct.StatusCode.NO_ELIGIBLE_OFFER)
                    message="Premium has no purchase option available for this Google Play account.";
                else message="Google Play could not load the Premium product (status "+product.getStatusCode()+").";
            } else message=billingUnavailable(result);
        }
        purchaseRequested=false;changed();
    }

    private void queryPurchases(boolean restoring) {
        if(!connected){if(restoring)restoreRequested=true;connect();return;}
        QueryPurchasesParams params=QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build();
        client.queryPurchasesAsync(params,(result,purchases)->{
            logResult("query purchases",result);ready=true;
            if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK){
                if(restoring)message=billingUnavailable(result);changed();return;
            }
            boolean found=false,waiting=false;
            for(Purchase purchase:purchases)if(purchase.getProducts().contains(PRODUCT_ID)) {
                if(purchase.getPurchaseState()==Purchase.PurchaseState.PURCHASED){found=true;processPurchased(purchase);}
                else if(purchase.getPurchaseState()==Purchase.PurchaseState.PENDING)waiting=true;
            }
            pending=waiting;
            boolean debug=BuildConfig.DEBUG&&preferences.getBoolean("debug-owned",false);
            owned=found||debug;preferences.edit().putBoolean("owned",found).apply();
            if(owned)message=debug&&!found?"Premium test unlock active.":"Premium unlocked.";
            else if(waiting)message="Purchase pending. Premium unlocks after Google Play confirms payment.";
            else if(restoring)message="No Premium purchase was found for this Google Play account.";
            restoreRequested=false;changed();
        });
    }

    private void processPurchased(Purchase purchase) {
        owned=true;pending=false;preferences.edit().putBoolean("owned",true).apply();
        if(!purchase.isAcknowledged())client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.getPurchaseToken()).build(),result->{
                logResult("acknowledge",result);
                if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK)
                    message="Premium is unlocked; Google Play acknowledgement will retry.";
                changed();
            });
    }

    @Override public void onPurchasesUpdated(BillingResult result,List<Purchase> purchases) {
        logResult("purchase update",result);
        if(result.getResponseCode()==BillingClient.BillingResponseCode.OK&&purchases!=null) {
            for(Purchase purchase:purchases)if(purchase.getProducts().contains(PRODUCT_ID)) {
                if(purchase.getPurchaseState()==Purchase.PurchaseState.PURCHASED){processPurchased(purchase);message="Premium unlocked.";}
                else if(purchase.getPurchaseState()==Purchase.PurchaseState.PENDING){pending=true;message="Purchase pending. Premium unlocks after payment is confirmed.";}
            }
        } else if(result.getResponseCode()!=BillingClient.BillingResponseCode.USER_CANCELED)message=purchaseError(result);
        changed();
    }

    private static void logResult(String action,BillingResult result) {
        Log.i(TAG,action+": code="+result.getResponseCode()+" message="+result.getDebugMessage());
    }
    private static String billingUnavailable(BillingResult result) {
        if(result.getResponseCode()==BillingClient.BillingResponseCode.BILLING_UNAVAILABLE)
            return "Google Play purchases are unavailable for this account or device.";
        if(result.getResponseCode()==BillingClient.BillingResponseCode.NETWORK_ERROR ||
            result.getResponseCode()==BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE)
            return "Google Play could not connect. Check the network and try again.";
        return "Google Play could not load Premium (error "+result.getResponseCode()+").";
    }
    private static String purchaseError(BillingResult result) {
        if(result.getResponseCode()==BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED)
            return "Premium is already owned. Tap Restore purchase.";
        if(result.getResponseCode()==BillingClient.BillingResponseCode.ITEM_UNAVAILABLE)
            return "Premium is not available from Google Play for this account.";
        return "Google Play could not complete the purchase (error "+result.getResponseCode()+").";
    }

    private void changed(){activity.runOnUiThread(listener::onChanged);}
    void destroy(){if(client!=null){client.endConnection();client=null;}connected=false;connecting=false;}
}

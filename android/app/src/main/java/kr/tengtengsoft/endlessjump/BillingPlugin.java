package kr.tengtengsoft.endlessjump;

import android.util.Log;
import androidx.annotation.NonNull;

import com.android.billingclient.api.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "Billing")
public class BillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private static final String TAG = "BillingPlugin";
    private BillingClient billingClient;
    private PluginCall pendingPurchaseCall;

    @Override
    public void load() {
        billingClient = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases()
                .build();

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    Log.d(TAG, "BillingClient connected");
                } else {
                    Log.w(TAG, "BillingClient setup failed: " + result.getDebugMessage());
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                Log.w(TAG, "BillingClient disconnected");
            }
        });
    }

    @PluginMethod
    public void getProducts(PluginCall call) {
        JSArray productIds = call.getArray("productIds");
        if (productIds == null) {
            call.reject("productIds is required");
            return;
        }

        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        try {
            for (int i = 0; i < productIds.length(); i++) {
                products.add(QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(productIds.getString(i))
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build());
            }
        } catch (Exception e) {
            call.reject("Invalid productIds");
            return;
        }

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(products)
                .build();

        billingClient.queryProductDetailsAsync(params, (result, productDetailsList) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                call.reject("Query failed: " + result.getDebugMessage());
                return;
            }

            JSArray arr = new JSArray();
            for (ProductDetails details : productDetailsList) {
                JSObject obj = new JSObject();
                obj.put("productId", details.getProductId());
                obj.put("name", details.getName());
                obj.put("description", details.getDescription());
                ProductDetails.OneTimePurchaseOfferDetails offer = details.getOneTimePurchaseOfferDetails();
                if (offer != null) {
                    obj.put("price", offer.getFormattedPrice());
                    obj.put("priceMicros", offer.getPriceAmountMicros());
                    obj.put("currencyCode", offer.getPriceCurrencyCode());
                }
                arr.put(obj);
            }

            JSObject ret = new JSObject();
            ret.put("products", arr);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId");
        if (productId == null) {
            call.reject("productId is required");
            return;
        }

        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        products.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.INAPP)
                .build());

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(products)
                .build();

        billingClient.queryProductDetailsAsync(params, (result, productDetailsList) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || productDetailsList.isEmpty()) {
                call.reject("Product not found: " + productId);
                return;
            }

            ProductDetails details = productDetailsList.get(0);
            BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(List.of(
                            BillingFlowParams.ProductDetailsParams.newBuilder()
                                    .setProductDetails(details)
                                    .build()))
                    .build();

            pendingPurchaseCall = call;
            BillingResult launchResult = billingClient.launchBillingFlow(getActivity(), flowParams);
            if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                pendingPurchaseCall = null;
                call.reject("Launch billing flow failed: " + launchResult.getDebugMessage());
            }
        });
    }

    @PluginMethod
    public void restorePurchases(PluginCall call) {
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build();

        billingClient.queryPurchasesAsync(params, (result, purchases) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                call.reject("Query purchases failed: " + result.getDebugMessage());
                return;
            }

            JSArray arr = new JSArray();
            for (Purchase purchase : purchases) {
                if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    for (String pid : purchase.getProducts()) {
                        arr.put(pid);
                    }
                    // Acknowledge if not yet
                    if (!purchase.isAcknowledged()) {
                        AcknowledgePurchaseParams ackParams = AcknowledgePurchaseParams.newBuilder()
                                .setPurchaseToken(purchase.getPurchaseToken())
                                .build();
                        billingClient.acknowledgePurchase(ackParams, r -> {});
                    }
                }
            }

            JSObject ret = new JSObject();
            ret.put("purchasedProducts", arr);
            call.resolve(ret);
        });
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult result, List<Purchase> purchases) {
        if (pendingPurchaseCall == null) return;

        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            JSArray arr = new JSArray();
            for (Purchase purchase : purchases) {
                for (String pid : purchase.getProducts()) {
                    arr.put(pid);
                }
                // Acknowledge
                if (!purchase.isAcknowledged()) {
                    AcknowledgePurchaseParams ackParams = AcknowledgePurchaseParams.newBuilder()
                            .setPurchaseToken(purchase.getPurchaseToken())
                            .build();
                    billingClient.acknowledgePurchase(ackParams, r -> {});
                }
            }
            JSObject ret = new JSObject();
            ret.put("purchasedProducts", arr);
            pendingPurchaseCall.resolve(ret);
        } else if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            pendingPurchaseCall.reject("USER_CANCELED");
        } else {
            pendingPurchaseCall.reject("Purchase failed: " + result.getDebugMessage());
        }
        pendingPurchaseCall = null;
    }
}

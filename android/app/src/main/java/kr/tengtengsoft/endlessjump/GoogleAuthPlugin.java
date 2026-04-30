package kr.tengtengsoft.endlessjump;

import android.content.Intent;
import android.util.Log;
import androidx.activity.result.ActivityResult;
import androidx.annotation.NonNull;

import com.getcapacitor.*;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.*;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

@CapacitorPlugin(name = "GoogleAuth")
public class GoogleAuthPlugin extends Plugin {

    private static final String TAG = "GoogleAuthPlugin";
    private GoogleSignInClient googleSignInClient;

    @Override
    public void load() {
        // Web Client ID는 JS에서 전달받으므로 여기서는 기본 설정만
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        String webClientId = call.getString("webClientId");
        if (webClientId == null || webClientId.isEmpty()) {
            call.reject("webClientId is required");
            return;
        }

        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(webClientId)
                .requestEmail()
                .build();

        googleSignInClient = GoogleSignIn.getClient(getActivity(), gso);

        // 기존 세션 로그아웃 후 새로 로그인 (계정 선택 화면 표시)
        googleSignInClient.signOut().addOnCompleteListener(task -> {
            Intent signInIntent = googleSignInClient.getSignInIntent();
            startActivityForResult(call, signInIntent, "handleSignInResult");
        });
    }

    @ActivityCallback
    private void handleSignInResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(result.getData());
        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);
            String idToken = account.getIdToken();

            if (idToken == null) {
                call.reject("ID token is null");
                return;
            }

            JSObject ret = new JSObject();
            ret.put("idToken", idToken);
            ret.put("email", account.getEmail());
            ret.put("displayName", account.getDisplayName());
            ret.put("photoUrl", account.getPhotoUrl() != null ? account.getPhotoUrl().toString() : null);
            ret.put("countryCode", java.util.Locale.getDefault().getCountry());
            call.resolve(ret);
        } catch (ApiException e) {
            Log.w(TAG, "Google sign in failed: " + e.getStatusCode());
            if (e.getStatusCode() == 12501) {
                call.reject("USER_CANCELED");
            } else {
                call.reject("Google sign in failed: " + e.getStatusCode());
            }
        }
    }
}

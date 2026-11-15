package cloud.artemisnet.vinapp;

import android.webkit.CookieManager;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
	@Override
	protected void load() {
		super.load();

		configureCookies();
	}

	@Override
	public void onStart() {
		super.onStart();

		configureCookies();
	}

	private void configureCookies() {
		CookieManager cookieManager = CookieManager.getInstance();
		cookieManager.setAcceptCookie(true);

		Bridge bridge = getBridge();
		if (bridge != null) {
			WebView webView = bridge.getWebView();
			if (webView != null) {
				cookieManager.setAcceptThirdPartyCookies(webView, true);
			}
		}

		cookieManager.flush();
	}
}
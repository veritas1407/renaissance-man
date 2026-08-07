package com.renaissanceman.app

import android.content.Intent
import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import org.json.JSONObject

/**
 * The share door.
 *
 * CLAUDE.md §4 makes zero-friction capture non-negotiable, but on a phone the
 * app had no way in: catching a link meant leaving whatever you were reading,
 * finding Renaissance Man, and pasting. An ACTION_SEND filter (see the manifest)
 * plus this handler turns any share sheet into the quill.
 *
 * Delivery is queue-shaped rather than a direct call: the WebView can exist well
 * before the frontend's own script has run, so Kotlin pushes onto a global array
 * that it creates if absent, and the frontend drains it whenever it is ready.
 * Each share carries an id so a retry can never capture the same thing twice.
 */
class MainActivity : TauriActivity() {
  private var webView: WebView? = null
  private val pending = ArrayDeque<Pair<String, String>>()

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    accept(intent)
  }

  override fun onWebViewCreate(webView: WebView) {
    this.webView = webView
    // A cold start hands us the WebView before the page has run its scripts;
    // the drain on the JS side is idempotent, so a couple of nudges are safe.
    webView.postDelayed({ deliver() }, 600)
    webView.postDelayed({ deliver() }, 2000)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    accept(intent)
    deliver()
  }

  /** Pull the shared text off an intent and hold it until the page can take it. */
  private fun accept(intent: Intent?) {
    if (intent == null || intent.action != Intent.ACTION_SEND) return
    val text = intent.getStringExtra(Intent.EXTRA_TEXT)
    if (text.isNullOrBlank()) return
    val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
    val body = if (!subject.isNullOrBlank() && !text.startsWith(subject)) "$subject\n$text" else text
    val id = System.currentTimeMillis().toString() + "-" + pending.size
    pending.addLast(Pair(id, body))
    // Don't re-fire this same share if the activity is recreated (rotation etc).
    intent.action = Intent.ACTION_MAIN
  }

  /** Hand everything held over to the page, creating the queue if it must. */
  private fun deliver() {
    val wv = webView ?: return
    if (pending.isEmpty()) return
    for ((id, body) in pending) {
      val js = "(function(){window.__RM_SHARES=window.__RM_SHARES||[];" +
        "window.__RM_SHARES.push({id:" + JSONObject.quote(id) +
        ",text:" + JSONObject.quote(body) + "});" +
        "if(window.RM_drainShares)window.RM_drainShares();})()"
      wv.evaluateJavascript(js, null)
    }
    pending.clear()
  }
}

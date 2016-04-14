let {components, Cu, Cc, Ci} = require("chrome");

let self = require("sdk/self");
let data = self.data;
let _ = require("sdk/l10n").get;
let notifications = require("sdk/notifications");
let pref = require("sdk/preferences/service");
let prefRoot = "extensions.@cleanit.";
let prefsList = ["showNotifications", "clearOnShutdown"];

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "PlacesUtils", "resource://gre/modules/PlacesUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "LoadContextInfo", "resource://gre/modules/LoadContextInfo.jsm");

//https://github.com/willlma/firefox-addon-sdk-menu-button
//let { MenuButton } = require("./lib/menu-button");

//https://github.com/freaktechnik/jetpack-panelview
let { PanelView } = require("./lib/panelview.js");

let { ToggleButton } = require("sdk/ui");
let workaround = require("./lib/panelview/workaround");

let cleanit = {
  prefs: {},
  clearCookies: function () {
    let cookieManager = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager);
    cookieManager.removeAll();
  },
  clearHistory: function () {
    //let browserHistory = Cc["@mozilla.org/browser/nav-history-service;1"].getService(Ci.nsIBrowserHistory);
    //browserHistory.removeAllPages();
    PlacesUtils.history.clear();
  },
  clearCache: function () {
    let cacheStorageService = Cc["@mozilla.org/netwerk/cache-storage-service;1"].getService(Ci.nsICacheStorageService);
    try {
      cacheStorageService.clear();
    } catch(exception) {}
    let imageCacheManager = Cc["@mozilla.org/image/cache;1"].getService(Ci.imgICache);
    try {
      imageCacheManager.clearCache(false); // true=chrome, false=content
    } catch(exception) {}
    let appCacheStorage = Cc["@mozilla.org/netwerk/cache-storage-service;1"].getService(Ci.nsICacheStorageService).
      appCacheStorage(LoadContextInfo.default, null);
    try {
      appCacheStorage.asyncEvictStorage(null);
    } catch(exception) {}
  },
  clearHttpLogins: function () {
    //clear HTTP basic auth
    let httpAuthManager = Cc["@mozilla.org/network/http-auth-manager;1"].getService(Ci.nsIHttpAuthManager);
    httpAuthManager.clearAll();
  },
  clearAll: function () {
    cleanit.clearCookies();
    cleanit.clearHistory();
    cleanit.clearCache();
    cleanit.clearHttpLogins();
  },
  restartBrowser: function () {
    Cc["@mozilla.org/toolkit/app-startup;1"].getService(Ci.nsIAppStartup).quit(Ci.nsIAppStartup.eForceQuit|Ci.nsIAppStartup.eRestart);
  },
  showNotification: function(message) {
    notifications.notify({
      iconURL: data.url("images/icon.svg"),
      title: "Clean It",
      text: message
    });
  }
};

for(let i=0;i<prefsList.length;++i){
  cleanit.prefs[prefsList[i]] = pref.get(prefRoot + prefsList[i]);
}

require("sdk/simple-prefs").on("", function(prefName){
  cleanit.prefs[prefName] = pref.get(prefRoot + prefName);
});

let panelView = PanelView({
  id: "cleanit-panelView",
  title: "Clean It",
  content: [{
    type: "button",
    label: _("pmClearCookies"),
    onClick(event) {
      cleanit.clearCookies();
      if(cleanit.prefs.showNotifications)
        cleanit.showNotification(_("nmBrowserCookiesCleared"));
    }
  },
  {
    type: "button",
    label: _("pmClearHistory"),
    onClick(event) {
      cleanit.clearHistory();
      if(cleanit.prefs.showNotifications)
        cleanit.showNotification(_("nmBrowserHistoryCleared"));
    }
  },
  {
    type: "button",
    label: _("pmClearCache"),
    onClick(event) {
      cleanit.clearCache();
      if(cleanit.prefs.showNotifications)
        cleanit.showNotification(_("nmBrowserCacheCleared"));
    }
  },
  {
    type: "button",
    label: _("pmClearHttpLogins"),
    onClick(event) {
      cleanit.clearHttpLogins();
      if(cleanit.prefs.showNotifications)
        cleanit.showNotification(_("nmHttpLoginsCleared"));
    }
  },
  {
    type: "separator"
  },
  {
    type: "button",
    label: _("pmClearAll"),
    onClick(event) {
      cleanit.clearAll();
      if(cleanit.prefs.showNotifications)
        cleanit.showNotification(_("nmAllBrowserDataCleared"));
    }
  },
  {
    type: "separator"
  },
  {
    type: "button",
    label: _("pmRestartBrowser"),
    onClick(event) {
      cleanit.restartBrowser();
    }
  }]
});

let button = ToggleButton({
  id: "cleanit-toolbutton",
  label: "Clean It",
  icon: {
    "16": data.url("images/icon.svg"),
    "32": data.url("images/icon.svg"),
    "64": data.url("images/icon.svg")
  },
  onClick(state){
    if(state.checked) {
      panelView.show(button);
    }
  }
});

// Uncheck the button if the panel is hidden by loosing focus
panelView.on("hide", () => {
  button.state("window", {checked: false});
});

// Don't close the menu panel or overflow panel when the button is clicked.
workaround.applyButtonFix(button);

exports.onUnload = function (reason) {
  if(reason === "shutdown") {
    if(cleanit.prefs.clearOnShutdown === 1 ) {
      let prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
      let doClear = prompts.confirm(null, _("prompt_title"), _("prompt_msg"));
      if(doClear) {
        cleanit.clearAll();
      }
    }
    else if(cleanit.prefs.clearOnShutdown === 2 ) {
      cleanit.clearAll();
    }
  }
};

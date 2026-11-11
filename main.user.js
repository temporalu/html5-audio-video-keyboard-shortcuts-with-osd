// ==UserScript==
// @name        HTML5 Audio/Video Keyboard Shortcuts With OSD
// @namespace   https://github.com/temporalu
// @version     0.0.1
// @license     AGPL-3.0
// @author      jcunews, temporalu
// @description Modified from jcunews' original script (https://greasyfork.org/en/scripts/...).
// @match       *://*/*
// @grant       none
// @run-at      document-start
// ==/UserScript==

/*
Notes:

- Some shortcuts won't work on non US keyboards. Non US keyboard users will need to manually edit the keys in the script.
- In YouTube, if the video speed is below 0.25x or above 2x, the YouTube setting display will be capped to 0.1x or 2x.
- Web browser video speeds: Firefox = 0.25 to 5.0; Chrome = 0.1 to 16.0.


Keyboard Shortcuts:

CTRL+,             = Rewind media by 1/30th second
CTRL+.             = Fast forward media by 1/30th second
CTRL+SHIFT+/       = Next frame (when paused; Firefox only)
SHIFT+LEFT         = Rewind media by 30 seconds
SHIFT+RIGHT        = Fast forward media by 30 seconds
CTRL+LEFT          = Rewind media by 1 minute
CTRL+RIGHT         = Fast forward media by 1 minute
CTRL+SHIFT+LEFT    = Rewind media by 5 minutes
CTRL+SHIFT+RIGHT   = Fast forward media by 5 minutes
CTRL+/             = Fast forward media by 1.5 minutes
Z                  = Rewind media by 15 seconds
X                  = Fast forward media by 30 seconds
0 to 9             = Seek media to 0%, 10%, 20%,...90%
SHIFT+0 to SHIFT+9 = Seek media to 5%, 15%, 25%,...95%
CTRL+1 to CTRL+5   = Change audio volume to 20%, 40%, 60$, 80%, 100%
CTRL+[             = Decrease media speed by 0.2x (by default)
CTRL+]             = Increase media speed by 0.2x (by default)
CTRL+;             = Reset media speed
CTRL+'             = Change custom media speed
CTRL+\             = Change unit of media speed increment/decrement
W                  = Set media speed to 2.4x
A                  = Set media speed to 1.5x
R                  = Set media speed to 3x
S                  = Decrease media speed by 0.1x
D                  = Increase media speed by 0.1x

For Widescreen Video Viewport:
CTRL+6             = Change video aspect ratio for widescreen content. Fix widescreen content shrunk to 4:3 TV format.
CTRL+7             = Change video aspect ratio for letterbox content. Fix 4:3 letterbox content stretched to widescreen format.
CTRL+8             = Change video aspect ratio for TV content. Fix 4:3 TV content stretched to widescreen format.

For 4:3 TV Video Viewport:
CTRL+SHIFT+6       = Change video aspect ratio for ultra widescreen content. Fix ultra widescreen content compressed into 4:3 TV format.
CTRL+SHIFT+7       = Half-zoom 4:3 letterbox content to remove half of top+bottom borders, but also remove left+right content a little.
                     This can also be used to half-zoom ultra widescreen content on widescreen viewport. i.e. half-zoom of CTRL+6.
CTRL+SHIFT+8       = Change video aspect ratio for widescreen content. Fix widescreen content compressed into 4:3 TV format.
CTRL+SHIFT+9       = Full-zoom 4:3 letterbox content to remove all of top+bottom borders, but also remove left+right content more.
                     This can also be used to zoom more of ultra widescreen content on widescreen viewport. i.e. zoom more of CTRL+6.

For Any Video Viewport:
CTRL+9             = Reset video aspect ratio
P                  = Toggle Picture-In-Picture / Video popout (Chrome/ium only. Use Ctrl+Shift+] for Firefox)
ALT+P              = Toggle Picture-In-Picture / Video popout (Chrome/ium only. Use Ctrl+Shift+] for Firefox)
ALT+S              = Take screenshot of current video frame (in its original size and aspect ratio)
L                  = Set video quality to 1080p, or the closest available quality (YouTube only)
*/

((eleOSD, osdTimer) => {

  //=== CONFIGURATION BEGIN ===

  //Domains to force media seek using left/right arrow keys without any modifier key.
  //For sites which disable left/right arrow keys for media seek. Space or line separated.
  //Use "*" to match one component of the domain name. i.e.: any characters right before any ".".
  //e.g. "*.amazon.com" which will match us.amazon.com, uk.amazon.com, etc. but not amazon.com.
  //Use "amazon.com" to match amazon.com but not us.amazon.com, uk.amazon.com, etc.
  var forceMediaSeekOnArrowKeyDomains = new RegExp(`
www.alibaba.com *.aliexpress.com *.amazon.com
www.facebook.com
www.tiktok.com
`.trim().split(/\s+/).map(
    s => "^" + s.replace(/([\$\^\(\)\+\[\]\{\}\|\\\?])/gi, "\\$1").replace(/\*/gi, "[^\.]+") + "$"
  ).join("|"), "i");

  //Video speed increment/decrement unit.
  var incrementUnit = 0.2;

  //Duration (in milliseconds) to display On Screen Display (OSD) when changing playback rate. Set to zero or less to disable.
  var osdTimeout = 3000;

  //Image format for video frame screenshot
  var imageFormat = "jpeg"; //can be jpeg or png

  //Keyboard shortcuts.
  //key           = Key name. String type if single shortcut, or array of string if multiple shortcut (for single function multiple shortcuts).
  //                Each key name can either be the character which is produced by the key (e.g. `A`, `4`, `*`, etc.),
  //                or the code name for the key (e.g. `Digit2`, `BracketLeft`, etc.).
  //                When SHIFT modifier is used with keys which produces a character, key code name should be used if the character is important.
  //                A list of key code names can be found here: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code/code_values
  //caseSensitive = `true` if key name is case-sensitive. If omitted, the default is not case-sensitive.
  //modifiers     = Any combinations of uppercased "C", "S", and "A", for Ctrl, Shift, and Alt keys. If omitted, the default is "".
  //videoOnly     = Apply only if a video element exist. If omitted, the default is always apply.
  //func          = Function to be called. Function arguments: elementObj, pressedKey, matchingKeyIndex
  //                elementObj      : The video/audio element.
  //                pressedKey      : The pressed key. Uppercased if matching keyboard shortcut is not case-sensitive.
  //                matchingKeyIndex: If multiple keys is specified, the index of the key array. `null` otherwise.
  //                keyObject       : The matching keyboard shortcut object in `keys` array.
  var keys = [
    { //ctrl+space: seek media to next frame (only when paused. firefox only)
      key: " ", modifiers: "C",
      func: (ele, key) => ele.seekToNextFrame && ele.seekToNextFrame()
    },
    { //0 to 9: seek media to 0%,10%,20%,...90%
      key: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], modifiers: "",
      func: (ele, key, keyIndex) => { ele.currentTime = keyIndex / 10 * ele.duration }
    },
    { //shift+0 to shift+9: seek media to 5%,15%,25%,...95%
      key: [")", "!", "@", "#", "$", "%", "^", "&", "*", "("], modifiers: "S",
      func: (ele, key, keyIndex) => { ele.currentTime = (keyIndex + 0.5) / 10 * ele.duration }
    },
    { //ctrl+1 to ctrl+5: set audio volume to 20%,40%,60%,80%,100%
      key: ["1", "2", "3", "4", "5"], modifiers: "C",
      func: (ele, key, keyIndex)  => updAudioVolume(ele, (parseInt(key) * 2) / 10)
    },
    { //left: rewind media by 5 seconds. if forceMediaSeekOnArrowKeyDomains matches
      key: (forceMediaSeekOnArrowKeyDomains.test(location.hostname) && "ArrowLeft") || "", modifiers: "",
      func: (ele, key) => { ele.currentTime -= 5 }
    },
    { //shift+left: rewind media by 30 seconds
      key: "ArrowLeft", modifiers: "S",
      func: (ele, key) => { ele.currentTime -= 30 }
    },
    { //ctrl+left: rewind media by 1 minute
      key: "ArrowLeft", modifiers: "C",
      func: (ele, key) => { ele.currentTime -= 60 }
    },
    { //ctrl+shift+left: rewind media by 5 minutes
      key: "ArrowLeft", modifiers: "CS",
      func: (ele, key) => { ele.currentTime -= 300 }
    },
    { //ctrl+,: rewind media by 1/30 second
      key: ",", modifiers: "C",
      func: (ele, key) => { ele.currentTime -= 1/30 }
    },
    { //right: fast forward media by 5 seconds. if forceMediaSeekOnArrowKeyDomains matches
      key: (forceMediaSeekOnArrowKeyDomains.test(location.hostname) && "ArrowRight") || "", modifiers: "",
      func: (ele, key) => { ele.currentTime += 5 }
    },
    { //shift+right: fast forward media by 30 seconds
      key: "ArrowRight", modifiers: "S",
      func: (ele, key) => { ele.currentTime += 30 }
    },
    { //ctrl+right: fast forward media by 1 minute
      key: "ArrowRight", modifiers: "C",
      func: (ele, key) => { ele.currentTime += 60 }
    },
    { //ctrl+shift+right: fast forward media by 5 minutes
      key: "ArrowRight", modifiers: "CS",
      func: (ele, key) => { ele.currentTime += 300 }
    },
    { //ctrl+.: fast forward media by 1/30th second
      key: ".", modifiers: "C",
      func: (ele, key) => { ele.currentTime += 1/30 }
    },
    { //ctrl+shift+/: next frame (when paused; firefox only)
      key: "?", modifiers: "CS",
      func: (ele, key) => ele.seekToNextFrame && ele.seekToNextFrame()
    },
    { //ctrl+/: fast forward media by 1.5 minutes
      key: "/", modifiers: "C",
      func: (ele, key) => { ele.currentTime += 87 }
    },
    { //z: rewind media by 15 seconds
      key: "Z", modifiers: "",
      func: (ele, key) => {
        ele.currentTime -= 15;
        showOSD("Rewind 15s");
      }
    },
    { //x: fast forward media by 30 seconds
      key: "X", modifiers: "",
      func: (ele, key) => {
        ele.currentTime += 30;
        showOSD("Forward 30s");
      }
    },
    { //ctrl+[: decrease media speed
      key: "[", modifiers: "C",
      func: (ele, key) => {
        key = ele.playbackRate - incrementUnit;
        if (key < 0.1) {
          key = 0.1;
        } else if ((key < 1) && (ele.playbackRate > 1)) key = 1;
        updVideoSpeed(ele, key);
      }
    },
    { //ctrl+]: increase media speed
      key: "]", modifiers: "C",
      func: (ele, key) => {
        key = ele.playbackRate + incrementUnit;
        if (key > 16) {
          key = 16;
        } else if ((key > 1) && (ele.playbackRate < 1)) key = 1;
        updVideoSpeed(ele, key);
      }
    },
    { //ctrl+;: reset media speed to 1x
      key: ";", modifiers: "C",
      func: (ele, key) => updVideoSpeed(ele, 1)
    },
    { //ctrl+': use custom media speed
      key: "'", modifiers: "C",
      func: (ele, key) => {
        if ((key = prompt("Enter media speed from 0.1 to 16 (inclusive).\ne.g.: 1 = Normal, 0.5 = Half, 2 = Double, 3 = Triple, etc.", ele.playbackRate)) === null) return;
        if (isNaN(key = parseFloat(key.trim()))) {
          alert("Input must be a number.");
          return;
        }
        updVideoSpeed(ele, (key = parseFloat(key.toFixed(1))) < 0.1 ? 0.1 : (key > 16 ? 16 : key));
      }
    },
    { //ctrl+\: change unit of media speed increment/decrement
      key: "\\", modifiers: "C",
      func: (ele, key) => {
        if ((key = prompt("Enter unit of media speed increment/decrement from 0.1 to 4 (inclusive).", incrementUnit)) === null) return;
        if (!isNaN(key = parseFloat(key.trim()))) {
          incrementUnit = (key = parseFloat(key.toFixed(1))) < 0.1 ? 0.1 : (key > 4 ? 4 : key);
        } else alert("Input must be a number.");
      }
    },
    { //w: set media speed to 2.4x
      key: "W", modifiers: "",
      func: (ele, key) => updVideoSpeed(ele, 2.4)
    },
    { //a: set media speed to 1.5x
      key: "A", modifiers: "",
      func: (ele, key) => updVideoSpeed(ele, 1.5)
    },
    { //r: set media speed to 3x
      key: "R", modifiers: "",
      func: (ele, key) => updVideoSpeed(ele, 3)
    },
    { //s: decrease media speed by 0.1x
      key: "S", modifiers: "",
      func: (ele, key) => {
        key = ele.playbackRate - 0.1;
        if (key < 0.1) key = 0.1;
        updVideoSpeed(ele, key);
      }
    },
    { //d: increase media speed by 0.1x
      key: "D", modifiers: "",
      func: (ele, key) => {
        key = ele.playbackRate + 0.1;
        if (key > 16) key = 16;
        updVideoSpeed(ele, key);
      }
    },
    { //ctrl+6: Widescreen aspect ratio
      key: "6", modifiers: "C", videoOnly: true,
      func: (ele, key) => updVideoAspect("scaleX(1.3333)", "Widescreen")
    },
    { //ctrl+7: Letterbox aspect ratio
      key: "7", modifiers: "C", videoOnly: true,
      func: (ele, key) => updVideoAspect("scaleY(1.3333)", "Letterbox")
    },
    { //ctrl+8: TV aspect ratio
      key: "8", modifiers: "C", videoOnly: true,
      func: (ele, key) => updVideoAspect("scaleX(0.75)", "TV")
    },
    { //ctrl+shift+6: Ultra widescreen aspect ratio
      key: "Digit6", modifiers: "CS", videoOnly: true,
      func: (ele, key) => updVideoAspect("scaleY(0.7168)", "Ultra Widescreen")
    },
    { //ctrl+shift+7: Half-zoom letterbox
      key: "Digit7", modifiers: "CS", videoOnly: true,
      func: (ele, key) => updVideoAspect("scale(1.1666)", "Letterbox Half-Zoom")
    },
    { //ctrl+shift+8: Widescreen on TV
      key: "Digit8", modifiers: "CS", videoOnly: true,
      func: (ele, key) => updVideoAspect("scaleY(0.5625)", "Widescreen On TV")
    },
    { //ctrl+shift+9: Full-zoom letterbox
      key: "Digit9", modifiers: "CS", videoOnly: true,
      func: (ele, key) => updVideoAspect("scale(1.3333)", "Letterbox Full-Zoom")
    },
    { //ctrl+9: reset video aspect ratio
      key: "9", modifiers: "C", videoOnly: true,
      func: (ele, key) => updVideoAspect("", "Reset")
    },
    { //p: toggle Picture-In-Picture / Video popout (Chrome/ium only. Use Ctrl+Shift+] for Firefox)
      key: "P", modifiers: "", videoOnly: true,
      func: (ele, key) => togglePiP(ele)
    },
    { //alt+p: toggle Picture-In-Picture / Video popout (Chrome/ium only. Use Ctrl+Shift+] for Firefox)
      key: "P", modifiers: "A", videoOnly: true,
      func: (ele, key) => togglePiP(ele)
    },
    { //alt+s: take screenshot of current video frame
      key: "S", modifiers: "A", videoOnly: true,
      func: (ele, key, cv, a) => {
        cv = document.createElement("CANVAS");
        cv.width = ele.videoWidth;
        if (cv.width) {
          cv.height = ele.videoHeight;
          cv.getContext("2d").drawImage(ele, 0, 0);
          a = document.createElement("A");
          a.href = cv.toDataURL("image/" + imageFormat);
          a.download = `video_frame_${ele.currentTime}.${imageFormat === "jpeg" ? "jpg" : imageFormat}`;
          a.style.display = "none";
          document.body.appendChild(a).click();
          return a.remove()
        }
      }
    },
    { //l: set video quality to 1080p, or the closest available quality (YouTube only)
      key: "L", modifiers: "", videoOnly: true,
      func: (ele, key) => updVideoQuality(ele)
    }
  ];
  keys.forEach((k, s, m) => {
    if ((k.modifiers === undefined) || !k.modifiers.toUpperCase) k.modifiers = "";
    s = k.modifiers.toUpperCase();
    k.modifiers = {ctrl: s.includes("C"), shift: s.includes("S"), alt: s.includes("A")}
  });

  //=== CONFIGURATION END ===

  var to = {createHTML: s => s}, tp = window.trustedTypes?.createPolicy ? trustedTypes.createPolicy("", to) : to, html = s => tp.createHTML(s);

  function showOSD(s) {
    if (osdTimeout < 0) return;
    if (eleOSD) {
      eleOSD.textContent = s;
    } else {
      eleOSD = document.createElement("DIV");
      eleOSD.style.cssText = "position:fixed;z-index:999999999;left:30px;top:30px;margin:0;padding:.2rem .5rem .1rem .5rem;width:auto;height:auto;font:normal 14pt/normal Arial,sans-serif;background:#444;color:#fff";
      eleOSD.textContent = s;
      document.body.appendChild(eleOSD);
    }
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => {
      eleOSD.remove();
      eleOSD = null;
    }, osdTimeout);
  }

  function stopEvent(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
  }

  function updVideoSpeed(ele, spd, e) {
    // if ((location.hostname === "www.youtube.com") && (e = ele.parentNode.parentNode).setPlaybackRate && (spd >= 0.25) && (spd <= 2)) {
    //   e.setPlaybackRate(spd = parseFloat(spd.toFixed(1)));
    // } else ele.playbackRate = spd = parseFloat(spd.toFixed(1));
    ele.playbackRate = spd = parseFloat(spd.toFixed(1));
    showOSD("Speed " + spd + "x");
  }

  function updVideoAspect(asp, label, s) {
    if (!(s = document.getElementById("vidAspOvr"))) document.body.appendChild(s = document.createElement("STYLE")).id = "vidAspOvr";
    s.innerHTML = html(asp ? `video{transform:${asp}!important}` : "");
    showOSD("Ratio: " + label);
  }

  function updAudioVolume(ele, vol, e) {
    if ((location.hostname === "www.youtube.com") && (e = ele.parentNode.parentNode).setVolume) {
      e.setVolume(vol * 100);
    } else ele.volume = vol;
    showOSD("Audio " + (vol * 100) + "%");
  }

  function togglePiP(ele) {
    if (!document.pictureInPictureEnabled) return showOSD("PiP N/A");
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
      showOSD("PiP Off");
    } else ele.requestPictureInPicture().then(() => showOSD("PiP On")).catch(() => showOSD("PiP N/A"));
  }

  function isVisible(ele) {
    while (ele && ele.tagName) {
      if (getComputedStyle(ele).display === "none") return false;
      ele = ele.parentNode
    }
    return true
  }

  function waitElement(find, tries, done, e) {
    if ((e = find())) return done(e);
    if (tries--) setTimeout(() => waitElement(find, tries, done), 50); else done();
  }

  function updVideoQuality(ele, e, r, p, m, pick) {
    //YouTube only: open the player's settings menu and select the quality closest to 1080p.
    if (!/(^|\.)youtube(-nocookie)?\.com$/.test(location.hostname)) return showOSD("Quality: N/A");
    r = ele.closest(".html5-video-player") || document;
    if (!(e = r.querySelector(".ytp-settings-button"))) return showOSD("Quality: N/A");
    pick = () => {
      m = [...r.querySelectorAll(".ytp-settings-menu .ytp-panel.ytp-quality-menu .ytp-menuitem")]
        .map(i => ({i: i, h: parseInt((i.textContent.match(/(\d+)p/i) || [])[1])}))
        .filter(o => o.h)
        .sort((a, b) => Math.abs(a.h - 1080) - Math.abs(b.h - 1080) || a.h - b.h)[0];
      if (!m) return showOSD("Quality: N/A");
      m.i.click();
      showOSD("Quality " + m.h + "p");
    };
    (e.getAttribute("aria-expanded") === "true") || e.click();
    waitElement(() => {
      p = r.querySelector(".ytp-settings-menu .ytp-panel.ytp-quality-menu");
      return (p && isVisible(p)) ? p : [...r.querySelectorAll(".ytp-settings-menu .ytp-panel .ytp-menuitem")].find(i => i.textContent.includes("Quality") && isVisible(i));
    }, 40, q => {
      if (!q) return showOSD("Quality: N/A");
      if (q.matches(".ytp-quality-menu")) return pick();
      q.click();
      waitElement(() => {
        p = r.querySelector(".ytp-settings-menu .ytp-panel.ytp-quality-menu");
        return (p && isVisible(p)) && p;
      }, 40, p => p ? pick() : showOSD("Quality: N/A"));
    });
  }

  incrementUnit = parseFloat((incrementUnit < 0.1 ? 0.1 : (incrementUnit > 1 ? 1 : incrementUnit)).toFixed(1));
  addEventListener("keydown", function(ev, ele, evkey, evcode, kkey) {
    if (
      (!(ele = document.activeElement) || !((ele.contentEditable === "true") || ["INPUT", "SELECT", "TEXTAREA"].includes(ele.tagName))) &&
      (ele = Array.prototype.find.call(document.querySelectorAll("video,audio"), e => !isNaN(e.duration)))
    ) {
      keys.some((k, a, i) => {
        a = !!k.key.sort;
        evkey = k.caseSensitive ? ev.key : ev.key.toUpperCase();
        evcode = k.caseSensitive ? ev.code : ev.code.toUpperCase();
        kkey = k.caseSensitive ? k.key : (a ? k.key.map(s => s.toUpperCase()) : k.key.toUpperCase());
        if (
          ((!a && ((kkey === evcode) || (kkey === evkey))) || (a && (((i = kkey.indexOf(evcode)) >= 0) || ((i = kkey.indexOf(evkey)) >= 0)))) &&
          (k.modifiers.ctrl === ev.ctrlKey) && (k.modifiers.shift === ev.shiftKey) && (k.modifiers.alt === ev.altKey) &&
          (!k.videoOnly || (ele.tagName === "VIDEO")) && (isVisible(ele) || (ele.tagName === "AUDIO"))
        ) {
          stopEvent(ev);
          k.func?.(ele, evkey, a ? i : null, k);
          return true;
        }
      });
    }
  }, true);

})();

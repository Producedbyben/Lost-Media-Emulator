LOST MEDIA EMULATOR — READ ME FIRST
===================================

INSTALL
  1. Drag "Lost Media Emulator" onto the Applications folder (shown in this window).
  2. Open it from your Applications folder.


IF macOS SAYS THE APP IS "DAMAGED" OR "CANNOT BE OPENED"
  This is expected, and the app is NOT damaged and NOT malware. macOS shows this
  for any app that hasn't yet been notarized by Apple (notarization is on the way).
  Clear it once, either way:

  EASIEST
    Double-click  "Fix damaged-app warning.command"  (in this window).
    Terminal opens, clears the flag, and closes. Then open the app normally.

  OR, IN TERMINAL
    Paste this line and press Return:

      xattr -dr com.apple.quarantine "/Applications/Lost Media Emulator.app"


TIP
  Installing through the itch.io app avoids this step entirely — it handles the
  macOS flag for you.

  Updates: you'll be notified inside the app when a new version is out. Download
  it from lostmediaemulator.com/mac (automatic updates arrive once the app is
  Apple-notarized).

  Questions → lostmediaemulator.com

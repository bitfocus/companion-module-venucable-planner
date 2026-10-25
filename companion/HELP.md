## VenuCable

[VenuCable](https://venucable.com) plans livestream and AV shows: the venue, kit, cables, crew and paperwork in one diagram. This module puts it on your Stream Deck:

- **Building the plan:** one key per item in your **My kit** (the items you've starred in VenuCable's Kit tab). Press it and the item drops into the middle of the plan on screen, selected, ready to drag into place. Plus Select / Cable / Measure / Cable route, Finish, undo, redo, duplicate, turn, delete, zoom and next area.
- **Show day:** drive the **live running order** (Reports → Run of show → Go live): Go / Next, Back, −1 / +1 minute, Hold, and keys that show the current segment, its countdown (amber in the last minute, red once it overruns), what's next and whether you're running late.

### Setting up

1. In VenuCable (Chrome, Edge or Firefox), open **Projects** and tick **Connect to Bitfocus Companion** under Stream Deck. Leave it on **Through VenuCable** and copy the **pairing key** it shows.
2. In Companion, add this connection and paste the key into **Pairing key**. The connection turns green once VenuCable is open.
3. Drag the presets onto your buttons. The **My kit** keys show your own kit names.

Companion can be on **any computer** with internet – the one VenuCable is open on, a server or a Pi. Both connect out to VenuCable's relay, so there's nothing to open on your network and no IP addresses to type. Only someone with your key can pair with your VenuCable; **New key** in VenuCable stops the old one working.

**No internet at the venue?** Choose **Same computer as VenuCable** in this connection and **Same computer, no internet** in VenuCable, and run Companion on the computer VenuCable is open on (leave the port at 41799). If the browser asks to let VenuCable "access other apps and services on this device", choose **Allow**.

### Live timers

Every timer on VenuCable's live screen can go on its own key (preset group _Live timers_): a big countdown (amber in the last minute, red when over), time into the segment, show running time, show time left, when the show will finish at this rate, late or early (green / amber / red) and the time of day. **GO** starts the show and moves on; **Next** (showing the next segment's name) moves on too. **−1 min** and **+1 min** change the time for the segment on now (the finish time moves with it). **Hold** stops the segment's countdown and turns amber, reading **Resume**; the show counts as late while it's held, and Go or Back also carry on. Timer keys are labelled SO FAR (time into this segment), SHOW RAN, SHOW LEFT, ENDS AT, LATE and TIME (time of day), and read –:–– until the show starts. They only show time: pressing one opens the live screen.

**Lock** locks the selected item in place (lit while it's locked). **Save** saves the plan to its file and turns amber with unsaved changes; save it once with Ctrl+S first, as a browser only opens its Save dialog for a click or key press in the tab.

**Finish** ends a cable route, room or road you're drawing (like Enter) and lights up while you draw. Undo and Redo go dark when there's nothing to undo or redo, and with view-only (Crew) access every key that changes the plan goes dark.

Keys you've already placed keep the actions they had: after updating the module, drag a preset again (or edit the key) to pick up a change to it.

### Kit by category

Rather than one long list, browse the catalogue a category at a time: **◀** and **▶** step through the categories (the middle key shows which, in its colour, and VenuCable's Kit tab opens it), the item keys show that category's kit – press one to drop it on the plan – and **More** pages through a big category. Another key switches between All kit and My kit. Set _Item keys on your "Kit by category" page_ in this connection's settings to the number of item keys you placed (10 fits a 15-key Stream Deck).

### Dials (Stream Deck + and + XL)

The _Dials_ presets go on the dials. In Companion the touch strip is its own row of buttons, just above the dials: put the matching _Touch strip_ preset over each dial to label it (touching the strip does nothing, so it can't move the show on by accident). Building: zoom (press to fit), turn (press for 90°), area, kit category (press for All kit / My kit), items page by page, undo / redo. Show day: now (press for the live screen), countdown (turn for ±1 minute, press to hold), next (press to GO), on time / late, show left, ends at.

### Ready-made Stream Deck + XL pages

VenuCable's Projects window (under Stream Deck) has two pages to download, **Build** and **Show day**, laid out with every key and dial in place. In Companion: **Import / Export → Import**, pick the file, choose the page and your VenuCable connection, then import. Put Show day on the page after Build (the bottom-right keys page between them), and set _Item keys on your "Kit by category" page_ to 14. Build gives two rows to the category's kit (14 keys), and its bottom-left key switches them between All kit and My kit. Show day leaves its bottom two rows free for your vMix or ATEM keys. The pages fill the touch strip as well as the dials. If a dial doesn't respond after importing, drag the matching _Dials_ preset onto it.

### Show timer for NDI (vMix, OBS)

VenuCable has a clean show-timer page that follows the live running order, whichever way the Stream Deck is connected (or with no Stream Deck). In VenuCable, press **Show timer** next to **Go live** in the Run of show (or under Projects), pick:

- **Operator** – now, countdown, cues, what's next, running late or early – or **Presenter** – a big countdown that turns amber with **WRAP UP** in the last minute and red with **TIME UP** when over;
- **Dark** or **Transparent** (no background, to key it over video);

then **Open** or **Copy address**.

In **vMix**, add a _Web Browser_ input with that address (1920 × 1080) and send it out as NDI. In **OBS**, add a _Browser Source_ and send it with the DistroAV plugin. The timer needs internet (even when the Stream Deck is on the same computer). It works on any computer, including a tablet as a confidence monitor; the page can only show the timer, never press keys. The VenuCable tab must stay open (it can be minimised).

From the deck (preset group _Show timer screen_): **Wrap up**, **Stretch** and **Stand by** put that message big on the presenter view (and at the top of the operator view); press again to clear it. Type your own message in the button's _Show timer screen: message to the presenter_ action. **Blank screen** blanks the page until pressed again. The _screen_url_ variable holds the page's address.

### Tips

- If two VenuCable tabs are open, the buttons follow the one you used most recently.
- My kit keys follow the order of My kit in VenuCable's Kit tab. Star or unstar kit there and the keys update.
- Turn and Delete act on whatever is selected in VenuCable.

window.siteConfig = {
  siteName: "Web Worlds",
  siteShortName: "WEB WORLDS",
  version: "0.27",
  backend: {
    apiBase: "https://web-worlds-scores.codyjustustucker.workers.dev/api",
    scoreModes: { desktop: "brick-breaker", mobile: "brick-breaker-mobile" },
    note: "Set apiBase to the deployed Cloudflare Worker URL ending in /api."
  },
  resumeUrl: "https://cody-portfolio-3ae.pages.dev",
  githubUrl: "https://github.com/codyjustustucker-spec",
  themeStorageKey: "cody-web-worlds-theme",
  routes: [
    { id:"home", label:"Home", href:"index.html", symbol:"CW" },
    { id:"playground", label:"Playground", href:"playground/", symbol:"◎" },
    { id:"3d", label:"3D Space", href:"3d/", symbol:"◇" },
    { id:"lab", label:"Lab", href:"lab/", symbol:"⌁" },
    { id:"room", label:"Room", href:"room/", symbol:"✦" },
    { id:"tunnel", label:"Tunnel", href:"tunnel/", symbol:"◉" },
    { id:"about", label:"About", href:"about/", symbol:"◈" },
    { id:"engineering", label:"Engineering", href:"engineering/", symbol:"⚙" }
  ],
  // Short parallel copy keeps theme changes expressive without making layouts jump.
  themeCopy: {
    "home.hero.line1": { cool:"Pick a signal.", cute:"Pick a world.", royal:"Choose a passage.", scary:"Choose a door." },
    "home.hero.line2": { cool:"Enter a system.", cute:"Come explore.", royal:"Enter the court.", scary:"Enter the dark." },
    "home.hero.lede": { cool:"Six routes are open. None of them behave quite the same.", cute:"Six tiny places are awake. Pick whichever one looks fun.", royal:"Six passages are open. Each keeps its own curious rules.", scary:"Six doors are awake. None of them feel entirely safe." },
    "home.directory.eyebrow": { cool:"ROUTE MAP", cute:"WHERE TO NEXT? ♡", royal:"COURT MAP ♛", scary:"DOOR MAP ☾" },
    "home.directory.title": { cool:"Choose a door.", cute:"Pick your adventure.", royal:"Choose a passage.", scary:"Choose what opens." },
    "home.directory.note": { cool:"Each route runs a different experiment.", cute:"Each place has its own tiny nonsense.", royal:"Each passage houses a different exhibit.", scary:"Each doorway keeps a different experiment." },

    "playground.hero.eyebrow": { cool:"PLAYGROUND / CHAPTER 01", cute:"PLAYGROUND / TINY QUEST ♡", royal:"PLAYGROUND / ROYAL TRIAL ♛", scary:"PLAYGROUND / NIGHT TRIAL ☾" },
    "playground.hero.title": { cool:"Grab it. Get it to the bottom.", cute:"Grab it. Guide it all the way down.", royal:"Take the core. Reach the lower court.", scary:"Take the core. Find the way below." },
    "playground.hero.lede": { cool:"A browser puzzle built from pointer events, collision logic, shared state, hidden secrets, and four visual worlds.", cute:"A tiny browser quest with dragging, collisions, shared clues, hidden secrets, and four dressed-up worlds.", royal:"A browser trial of dragging, collisions, shared clues, hidden relics, and four shifting courts.", scary:"A browser trial of dragging, collisions, shared clues, hidden omens, and four uneasy worlds." },
    "playground.move.label": { cool:"MOVE", cute:"SCOOT", royal:"SHIFT", scary:"PUSH" },
    "playground.move.note": { cool:"Clear the passage.", cute:"Scoot it aside.", royal:"Clear the passage.", scary:"Move what blocks you." },
    "playground.exit.label": { cool:"EXIT", cute:"HOME", royal:"PASSAGE", scary:"WAY OUT" },
    "playground.exit.note": { cool:"Bring the player here.", cute:"Bring your player here.", royal:"Escort the player here.", scary:"Bring the player here." },
    "playground.mobile.eyebrow": { cool:"TOUCH PLAYGROUND", cute:"POCKET PLAYGROUND ♡", royal:"POCKET TRIAL ♛", scary:"POCKET TRIAL ☾" },
    "playground.mobile.title": { cool:"Small screen. Real toys.", cute:"Tiny screen. Tiny toys.", royal:"Small court. Real trials.", scary:"Small screen. Strange toys." },
    "playground.mobile.note": { cool:"A compact touch-first set of experiments. Same worlds, fewer elbows.", cute:"A compact touch-first set of little toys. Same worlds, softer elbows.", royal:"A compact touch-first set of trials. Same worlds, tighter quarters.", scary:"A compact touch-first set of experiments. Same worlds, closer walls." },

    "lab.hero.eyebrow": { cool:"LAB / MECHANICS WORKSHOP", cute:"LAB / TINY TOY WORKSHOP ♡", royal:"LAB / ROYAL WORKSHOP ♛", scary:"LAB / FORBIDDEN WORKSHOP ☾" },
    "lab.hero.title": { cool:"Take the toys apart before putting them in the game.", cute:"Take the tiny toys apart before building the big game.", royal:"Study each mechanism before it joins the greater machine.", scary:"Take each mechanism apart before it learns your name." },
    "lab.hero.lede": { cool:"These benches isolate the browser systems used elsewhere in Web Worlds. Lab explains the pieces. Playground turns them into problems.", cute:"These benches isolate the tiny browser tricks used across Web Worlds. Lab shows the pieces. Playground turns them into puzzles.", royal:"These benches isolate the browser mechanisms used across Web Worlds. Lab studies the pieces. Playground turns them into trials.", scary:"These benches isolate the browser mechanisms hiding across Web Worlds. Lab exposes the pieces. Playground turns them loose." },
    "lab.hero.primary": { cool:"Open the benches", cute:"Open the toy benches", royal:"Open the royal benches", scary:"Open the dark benches" },
    "lab.hero.secondary": { cool:"Try the combined version →", cute:"Try them all together →", royal:"Enter the combined trial →", scary:"See what they become →" },
    "lab.index": { cool:"BENCH INDEX", cute:"TOY INDEX ♡", royal:"COURT INDEX ♛", scary:"RITUAL INDEX ☾" },

    "home.orbit.playground": { cool:"find the way", cute:"secrets inside", royal:"pass the royal trial", scary:"break the seal" },
    "home.orbit.lab": { cool:"touch the machinery", cute:"poke the gadgets", royal:"inspect the instruments", scary:"touch the apparatus" },
    "home.orbit.3d": { cool:"leave the flat world", cute:"float somewhere pretty", royal:"enter the crown chamber", scary:"leave the waking world" },
    "home.orbit.room": { cool:"something is moving", cute:"little friends live here", royal:"the court is alive", scary:"something is hungry" },
    "home.orbit.tunnel": { cool:"fall through the signal", cute:"sparkly impossible hole", royal:"descend the gilded passage", scary:"enter the veil" },
    "home.orbit.about": { cool:"behind the worlds", cute:"who made all this?", royal:"meet the architect", scary:"who built the haunt" },
    "home.status.1.title": { cool:"SIGNAL FOUND", cute:"HELLO THERE ♡", royal:"COURT OPEN ♛", scary:"EYE OPEN ☾" },
    "home.status.1.note": { cool:"Choose any live node.", cute:"The little worlds noticed you.", royal:"Choose any royal gate.", scary:"Choose any breathing door." },
    "home.status.2.title": { cool:"WORLD SHIFT", cute:"WORLD SHIFT", royal:"COURT SHIFT", scary:"WORLD TWITCH" },
    "home.status.2.note": { cool:"The map remembers your theme.", cute:"Everything gets a costume change.", royal:"The court remembers your colors.", scary:"The map remembers what you chose." },
    "home.status.3.title": { cool:"NO SAFE ROUTE", cute:"TINY SECRET", royal:"NO COMMON ROAD", scary:"NO SAFE ROUTE" },
    "home.status.3.note": { cool:"Good.", cute:"Probably hiding somewhere.", royal:"As intended.", scary:"Good." },

    "3d.hero.title": { cool:"Tune the chamber.", cute:"Build your little universe.", royal:"Tune the royal chamber.", scary:"Tune the watching chamber." },
    "3d.hero.lede": { cool:"Spin it, reshape it, recolor it, and peel the scene apart.", cute:"Pick a shape, change the shine, hide a few moons, and make it yours.", royal:"Spin the relics, reshape the core, and retune the gilded chamber.", scary:"Spin the relics, reshape the omen, and see what keeps watching." },

    "room.hero.title": { cool:"A tiny world that refuses to stay still.", cute:"A little garden full of troublemakers.", royal:"A tiny court that refuses to behave.", scary:"A little haunted room that will not stay quiet." },
    "room.hero.lede": { cool:"Drop objects into the habitat, feed the locals, and see what the simulation does with them.", cute:"Drop snacks and toys into the garden, pet tiny friends, and see who notices first.", royal:"Drop provisions and playthings into the royal grounds and see who takes notice.", scary:"Leave offerings and odd little toys in the dark and see what notices first." },

    "tunnel.hero.eyebrow": { cool:"20 / SPATIAL DEPTH", cute:"20 / SPARKLY DEPTH ♡", royal:"20 / ROYAL DESCENT ♛", scary:"20 / VEIL DESCENT ☾" },
    "tunnel.hero.title": { cool:"Keep descending.", cute:"Down the impossible sparkly hole.", royal:"Descend through the gilded void.", scary:"Descend through the watching dark." },
    "tunnel.final.title": { cool:"DEPTH CONFIRMED", cute:"YOU MADE IT ♡", royal:"COURT BELOW REACHED", scary:"THE VEIL OPENS" },
    "tunnel.final.note": { cool:"return signal acquired", cute:"sparkly descent complete ✦", royal:"gilded passage complete", scary:"something followed you back" },
    "tunnel.cta.eyebrow": { cool:"RETURN SIGNAL", cute:"BACK UP WE GO ♡", royal:"RETURN TO COURT ♛", scary:"RETURN WHILE YOU CAN ☾" },
    "tunnel.cta.title": { cool:"Tunnel complete.", cute:"Sparkly tunnel complete.", royal:"Royal descent complete.", scary:"The descent is complete." },
    "tunnel.cta.note": { cool:"Back to the workshop, or return to the world map.", cute:"Back to the gadgets, or hop to the world map.", royal:"Return to the workshop, or survey the world map.", scary:"Return to the workshop, or find the world map." },

    "about.eyebrow": { cool:"ABOUT / CREATOR", cute:"ABOUT / MAKER ♡", royal:"ABOUT / ARCHITECT ♛", scary:"ABOUT / WORLDMAKER ☾" },
    "about.title": { cool:"Cody Tucker // Builder", cute:"Cody Tucker ♡ Maker", royal:"Cody Tucker // Architect", scary:"Cody Tucker // Worldmaker" },
    "about.intro": { cool:"I built Web Worlds as a browser playground for interactive systems, small games, simulations, and visual experiments.", cute:"I built Web Worlds as a browser playground for tiny games, playful systems, simulations, and colorful experiments.", royal:"I built Web Worlds as a browser gallery for interactive systems, small games, simulations, and crafted experiments.", scary:"I built Web Worlds as a browser labyrinth for interactive systems, small games, simulations, and strange experiments." },
    "about.worlds.eyebrow": { cool:"WEB WORLDS", cute:"LITTLE WORLDS ♡", royal:"ROYAL WORLDS ♛", scary:"STRANGE WORLDS ☾" },
    "about.worlds.title": { cool:"Back to the experiments.", cute:"Back to the little worlds.", royal:"Return to the royal worlds.", scary:"Return to the strange worlds." },
    "about.worlds.note": { cool:"The experiments stay separate from the professional links, but they share one frontend system.", cute:"The little worlds stay apart from the work links, but they all share one playful system.", royal:"The exhibits stay apart from the professional links, while sharing one crafted frontend system.", scary:"The strange worlds stay apart from the work links, while sharing one quietly connected system." },
    "about.worlds.button": { cool:"Open World Map →", cute:"Open Little Map →", royal:"Open Court Map →", scary:"Open Dark Map →" },
    "engineering.eyebrow": { cool:"ENGINEERING / PROOF", cute:"ENGINEERING / SPARKLY GUTS ♡", royal:"ENGINEERING / WORKS OF THE COURT ♛", scary:"ENGINEERING / BENEATH THE FLOORBOARDS ☾" },
    "engineering.title": { cool:"Under the hood.", cute:"Tiny worlds. Serious machinery.", royal:"Inspect the machinery.", scary:"See what keeps it alive." },
    "engineering.lede": { cool:"Measured quality, automated tests, accessibility work, performance evidence, and the delivery pipeline behind Web Worlds.", cute:"Real tests, real measurements, careful accessibility, and all the tidy machinery keeping the tiny worlds alive.", royal:"Measured quality, automated trials, accessibility work, performance evidence, and the delivery pipeline beneath the exhibit.", scary:"Real tests, measured performance, accessibility work, and the machinery humming behind the walls." }
  }
};
// Backward-compatible alias for older code that still expects rooms.
window.siteConfig.rooms = window.siteConfig.routes.filter((route) => !["home","about","engineering"].includes(route.id));

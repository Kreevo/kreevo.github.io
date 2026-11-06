// MotionType 2.0 preset table.
// anim: what the "MT Animator" moves at 100% selection —
//   pos: [x, y] multipliers of the Amount slider, scale/rot/track/coff: fixed values, op: fade from 0.
// mode: smooth | hold (typing) | shake (emphasis, not an entrance).
// pv: which preview the panel plays.

var SFX = [
  ['whoosh-in.mp3', 'Whoosh'], ['quick-swoosh.mp3', 'Swoosh'], ['air-swipe.mp3', 'Air swipe'], ['swipe-rise.mp3', 'Rise swipe'],
  ['swoosh-bright.mp3', 'Bright swoosh'], ['impact-whoosh.mp3', 'Impact'], ['soft-pop.mp3', 'Soft pop'], ['pop-1.mp3', 'Pop'],
  ['sparkle-pop.wav', 'Sparkle'], ['snap-tick.mp3', 'Tick'], ['rise-tick.mp3', 'Rise tick'], ['keyboard-typing.mp3', 'Typing'],
  ['counter-tick.mp3', 'Counter']
];

var CATS = [
  { name: 'Text', icon: 'T', col: '#7678ff', items: [
    { key: 'rise', name: 'Rise', ic: 'A↑', unit: 'letter', amount: 60, delay: .04, dur: .7, blur: 8, anim: { pos: [0, 1], op: 1 }, sfx: 'swipe-rise.mp3', pv: 'rise' },
    { key: 'blurin', name: 'Blur In', ic: '◍', unit: 'letter', amount: 20, delay: .03, dur: .8, blur: 24, anim: { pos: [0, 1], scale: 115, op: 1 }, sfx: 'air-swipe.mp3', pv: 'blur' },
    { key: 'pop', name: 'Pop', ic: '●', unit: 'letter', amount: 0, delay: .04, dur: .5, blur: 0, bounce: 1, anim: { scale: 0, op: 1 }, sfx: 'soft-pop.mp3', pv: 'pop' },
    { key: 'typing', name: 'Typing', ic: '▍', unit: 'letter', amount: 0, delay: .05, dur: .05, blur: 0, mode: 'hold', anim: { op: 1 }, sfx: 'keyboard-typing.mp3', pv: 'type' },
    { key: 'slide', name: 'Slide', ic: '→', unit: 'word', amount: 120, delay: .07, dur: .7, blur: 10, anim: { pos: [-1, 0], op: 1 }, sfx: 'quick-swoosh.mp3', pv: 'slide' },
    { key: 'wave', name: 'Wave', ic: '∿', unit: 'letter', amount: 50, delay: .05, dur: .8, blur: 0, bounce: 1, anim: { pos: [0, 1], rot: -25, op: 1 }, sfx: 'swoosh-bright.mp3', pv: 'wave' },
    { key: 'decode', name: 'Decode', ic: '#$', unit: 'letter', amount: 0, delay: .04, dur: .9, blur: 0, anim: { coff: 24, op: 1 }, sfx: 'snap-tick.mp3', pv: 'decode' },
    { key: 'counter', name: 'Counter', ic: '12', unit: 'letter', amount: 0, delay: 0, dur: 2, blur: 0, counter: 1, anim: {}, sfx: 'counter-tick.mp3', pv: 'counter', text: '1,250+' }
  ]},
  { name: 'Apple style', icon: 'A', col: '#3a3a44', items: [
    { key: 'soft', name: 'Soft Reveal', ic: 'Aa', nw: 1, unit: 'word', amount: 30, delay: .08, dur: 1, blur: 14, anim: { pos: [0, 1], op: 1 }, sfx: 'air-swipe.mp3', pv: 'blur' },
    { key: 'focus', name: 'Word Focus', ic: 'W', nw: 1, unit: 'word', amount: 0, delay: .12, dur: .9, blur: 36, anim: { scale: 108, op: 1 }, sfx: 'air-swipe.mp3', pv: 'blur' },
    { key: 'linelift', name: 'Line Lift', ic: '≡', nw: 1, unit: 'line', amount: 90, delay: .15, dur: .9, blur: 6, mask: 1, anim: { pos: [0, 1], op: 1 }, sfx: 'swipe-rise.mp3', pv: 'mask' },
    { key: 'keynote', name: 'Keynote Title', ic: 'K', nw: 1, unit: 'letter', amount: 0, delay: 0, dur: 1.4, blur: 16, anim: { track: 40, op: 1 }, sfx: 'whoosh-in.mp3', pv: 'track' }
  ]},
  { name: 'Animate', icon: '▶', col: '#34d682', items: [
    { key: 'bounce', name: 'Bounce', ic: '⌒', unit: 'letter', amount: 80, delay: .05, dur: .8, blur: 0, bounce: 1, anim: { pos: [0, -1], op: 1 }, sfx: 'pop-1.mp3', pv: 'drop' },
    { key: 'elastic', name: 'Elastic', ic: '◠', unit: 'word', amount: 0, delay: .1, dur: .9, blur: 0, bounce: 1, anim: { scale: 0, op: 1 }, sfx: 'sparkle-pop.wav', pv: 'pop' },
    { key: 'shake', name: 'Shake', ic: '≈', unit: 'letter', amount: 30, delay: .01, dur: .8, blur: 0, mode: 'shake', anim: { pos: [.3, 0], rot: 12 }, sfx: 'impact-whoosh.mp3', pv: 'shake' },
    { key: 'flip', name: 'Flip', ic: '⇵', nw: 1, unit: 'letter', amount: 0, delay: .04, dur: .6, blur: 4, bounce: 1, anim: { scale: [100, 0], op: 1 }, sfx: 'snap-tick.mp3', pv: 'flip' },
    { key: 'spin', name: 'Spin', ic: '↻', nw: 1, unit: 'letter', amount: 0, delay: .04, dur: .8, blur: 6, anim: { scale: 0, rot: -180, op: 1 }, sfx: 'whoosh-in.mp3', pv: 'spin' },
    { key: 'float', name: 'Float', ic: '○', unit: 'word', amount: 40, delay: .15, dur: 1.4, blur: 4, anim: { pos: [0, 1], scale: 90, op: 1 }, sfx: 'air-swipe.mp3', pv: 'rise' }
  ]},
  { name: 'Reveal', icon: '⇄', col: '#ff6228', items: [
    { key: 'mask', name: 'Mask Reveal', ic: '▭', unit: 'letter', amount: 110, delay: .03, dur: .7, blur: 0, mask: 1, anim: { pos: [0, 1] }, sfx: 'swipe-rise.mp3', pv: 'mask' },
    { key: 'wipe', name: 'Wipe', ic: '▤', unit: 'letter', amount: 0, delay: 0, dur: .8, blur: 0, wipe: { feather: 0 }, anim: {}, sfx: 'quick-swoosh.mp3', pv: 'wipe' },
    { key: 'gradreveal', name: 'Gradient Reveal', ic: '◐', unit: 'letter', amount: 0, delay: 0, dur: 1.1, blur: 0, wipe: { feather: 250 }, anim: {}, sfx: 'air-swipe.mp3', pv: 'wipe' },
    { key: 'zoom', name: 'Zoom In', ic: '⤢', unit: 'word', amount: 0, delay: .08, dur: .8, blur: 20, anim: { scale: 260, op: 1 }, sfx: 'whoosh-in.mp3', pv: 'zoom' }
  ]},
  { name: 'Style', icon: '✦', col: '#ff4655', items: [
    { key: 'shiny', name: 'Shiny', ic: '✧', unit: 'letter', amount: 40, delay: .03, dur: .7, blur: 6, sweep: 1, anim: { pos: [0, 1], op: 1 }, sfx: 'sparkle-pop.wav', pv: 'rise' },
    { key: 'neon', name: 'Neon Glow', ic: '✦', unit: 'letter', amount: 0, delay: .03, dur: .8, blur: 20, glow: 1, color: '#3ec7ff', anim: { scale: 115, op: 1 }, sfx: 'swoosh-bright.mp3', pv: 'blur' },
    { key: 'gradient', name: 'Gradient', ic: '◑', unit: 'letter', amount: 50, delay: .04, dur: .7, blur: 8, color: 'grad', anim: { pos: [0, 1], op: 1 }, sfx: 'swipe-rise.mp3', pv: 'rise' },
    { key: 'outline', name: 'Outline', ic: '◯', unit: 'letter', amount: 50, delay: .04, dur: .7, blur: 8, outline: 1, anim: { pos: [0, 1], op: 1 }, sfx: 'swipe-rise.mp3', pv: 'rise' }
  ]}
];

var COLORS = ['keep', '#ffffff', '#7678ff', '#ff6228', '#34d682', '#ff4655', '#3ec7ff', '#ffd23f', 'grad'];
var GRAD = ['#7678ff', '#ff6228'];

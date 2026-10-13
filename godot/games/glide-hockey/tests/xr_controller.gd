## Glide Hockey with a headset, without a headset: fake controllers (`@kit/runtime/xr/simulated`)
## and the automatic player that grabs the mallet with the hand and plays a whole match moving it
## over the table, along the same path as a real hand. Each case mounts the game again with its
## hall settings and checks the kit's XR grammar with the game's real shared files
## (`uiHeight.ts`, `hostAnchor.ts`, `grab.ts`, `hapticFeedback.ts`):
##
## - the mallet is grabbed by the dominant hand of the save (`xrcade:hand`), and the countdown
##   waits for it: with no mallet in the hand there is no serve;
## - seated at eye level the world drops by what the eyes drop below 1.6 m; standing, nothing; and
##   the interface rises over the world by what it lacks to end up at eye level
##   (`uiRiseOverWorld`, the web's `XRUiHeight`);
## - with the hall, the table is planted where the anchor lends; without it, at the feet and
##   facing forward;
## - the other hand's stick turns the scenery 30° when seated, and not when standing;
## - it vibrates in the hand that carries the mallet, and only in it: the hits on the puck, the
##   goals and the ending (and the hit taken of the goal against, which goes to both);
## - the four hints of the web's script are seen —the footprints, the real controller beside the
##   ghost mallet, the ghost and the goal mark— and at the end none; the tutorial comes up, with
##   the real controller in both hands; whoever is late grabbing the mallet sees the grip lit on
##   both controllers while the countdown waits for it; and without augmented reality, the room is
##   all around.
##
## It is launched with `--fixed-fps 72`, like the automatic player.
extends Node

const MAIN := "res://games/glide-hockey/main.tscn"
const SALON := preload("res://games/glide-hockey/tests/fake_salon.gd")
const REFERENCE := 1.6
const TURN_STEP := PI / 6
const MAX_FRAMES := 72 * 180
const OPENXR_PROFILE := "/interaction_profiles/oculus/touch_controller"
const HINTS := ["floor", "controller", "gesture", "goal"]

const CASES := [
	{
		"name": "right-handed, seated in the hall",
		"settings": {"xrcade:hand": "right", "xrcade:play-height": "eyes"},
		"eyes": 1.15,
		"anchor": {"position": Vector3(0.3, 0.0, -0.2), "yaw": 0.25},
		"turns": true,
		"grabs_late": true,
	},
	{
		"name": "left-handed, standing, with one tap, without the hall",
		"settings": {"xrcade:hand": "left", "xrcade:play-height": "standing", "xrcade:grab": "toggle", "xrcade:play-height-offset": "-15"},
		"eyes": 1.7,
		"anchor": null,
		"turns": false,
		"grabs_late": false,
	},
]

var case_index := -1
var game: Node
var salon: Node
var frames := 0
var failures: Array[String] = []


func _ready() -> void:
	AudioServer.add_bus()
	var bus := AudioServer.bus_count - 1
	AudioServer.set_bus_name(bus, "Muted")
	AudioServer.set_bus_mute(bus, true)
	next_case()


func next_case() -> void:
	if game != null:
		game.queue_free()
		game = null
	if salon != null:
		# Out right now, not at the end of the frame: the next game looks for `/root/XRcade` on
		# entering.
		salon.get_parent().remove_child(salon)
		salon.free()
		salon = null
	case_index += 1
	if case_index >= CASES.size():
		print("XR-CONTROLLER %s %s" % ["ok" if failures.is_empty() else "FAIL", "; ".join(failures)])
		get_tree().quit(0 if failures.is_empty() else 1)
		return
	var c: Dictionary = CASES[case_index]
	if c.anchor != null:
		salon = SALON.new()
		salon.name = "XRcade"
		salon.anchor_position = c.anchor.position
		salon.anchor_yaw = c.anchor.yaw
		get_tree().root.add_child.call_deferred(salon)
	frames = 0
	game = (load(MAIN) as PackedScene).instantiate()
	game.set_meta("harness", true)
	game.set_meta("sfx_bus", "Muted")
	game.set_meta("xr_simulated", true)
	game.set_meta("eyes", c.eyes)
	game.set_meta("ajustes", JSON.stringify(c.settings))
	if c.grabs_late:
		game.set_meta("grabs_late", true)
	add_child.call_deferred(game)


func _process(_delta: float) -> void:
	if game == null or not game.is_inside_tree():
		return
	frames += 1
	# The fake controllers arrive without a profile: they are given that of the Quest ones, as the
	# headset would.
	for hand in ["left_hand", "right_hand"]:
		var tracker := XRServer.get_tracker(hand) as XRPositionalTracker
		if tracker != null and tracker.profile != OPENXR_PROFILE:
			tracker.profile = OPENXR_PROFILE
	if game.has_meta("result"):
		check(JSON.parse_string(game.get_meta("result")))
		next_case()
	elif frames > MAX_FRAMES:
		failures.append("%s: the match has not ended in %d frames (phase %s)" % [CASES[case_index].name, MAX_FRAMES, game.phase()])
		next_case()


func near(a: float, b: float, margin := 1e-3) -> bool:
	return absf(a - b) <= margin


func check(r: Dictionary) -> void:
	var c: Dictionary = CASES[case_index]
	var f: Array[String] = []
	var xr: Dictionary = r.xr
	var dominant: String = c.settings["xrcade:hand"]

	if r.outcome == null or int(r.goals) == 0:
		f.append("the match has not ended with goals (%s, %d goals)" % [r.outcome, r.goals])
	if int(r.playerHits) == 0:
		f.append("the mallet in the hand has not touched the puck")
	if xr.hand != dominant or xr.carried != [dominant]:
		f.append("the mallet was carried by %s and the dominant hand is %s" % [xr.carried, dominant])

	# The hall's fine height (`xrcade:play-height-offset`, in centimetres) moves the world and
	# nothing else.
	var to_eyes: float = (c.eyes - REFERENCE) if c.settings["xrcade:play-height"] == "eyes" else 0.0
	var rise: float = to_eyes + float(c.settings.get("xrcade:play-height-offset", "0")) / 100.0
	if not near(float(xr.rise), rise):
		f.append("the world rose %.3f and had to rise %.3f" % [xr.rise, rise])

	# The controller beside the ghost mallet is the dominant hand's, and on its side of the mallet.
	var beside: Dictionary = xr.controllerBeside
	if beside.hand != dominant or (float(beside.x) > 0.0) != (dominant == "right"):
		f.append("the controller beside the mallet is the %s one at x = %.3f and the dominant hand is %s" % [beside.hand, beside.x, dominant])

	var ui_rise: float = (c.eyes - REFERENCE) - to_eyes
	if not near(float(xr.ui), ui_rise):
		f.append("the interface rises %.3f over the world and had to rise %.3f" % [xr.ui, ui_rise])

	var placement: Dictionary = xr.placement
	if c.anchor != null:
		if not (near(placement.x, c.anchor.position.x) and near(placement.z, c.anchor.position.z) and near(placement.yaw, c.anchor.yaw)):
			f.append("planted at %s and the hall lent %s" % [placement, c.anchor])
	elif not (near(placement.x, 0.0) and near(placement.z, 0.0) and near(placement.yaw, 0.0)):
		f.append("without the hall it had to be planted at the feet and facing forward: %s" % placement)

	var turn: float = TURN_STEP if c.turns else 0.0
	if not near(float(xr.turn), turn):
		f.append("turned %.3f and it should be %.3f" % [xr.turn, turn])

	if int(xr.vibrations) == 0:
		f.append("nothing has vibrated")
	var other := "left" if dominant == "right" else "right"
	# The other hand only vibrates with the hit taken, which is the body's and goes to both.
	if other in xr.handsThatVibrated and int(r.hitsTaken) == 0:
		f.append("the %s hand vibrated, and it does not carry the mallet" % other)

	for hint in HINTS:
		if not hint in xr.hintsSeen:
			f.append("the hint «%s» was not seen (seen: %s)" % [hint, xr.hintsSeen])
	if not xr.hintsAtTheEnd.is_empty():
		f.append("at the end %s are still in view" % [xr.hintsAtTheEnd])
	if not xr.tutorial:
		f.append("the tutorial has not come up")
	if not ("left" in xr.tutorialControllers and "right" in xr.tutorialControllers):
		f.append("the tutorial's real controller came up in %s and had to come up in both" % [xr.tutorialControllers])
	if c.grabs_late and not ("left" in xr.countdownControllers and "right" in xr.countdownControllers):
		f.append("the stopped countdown had to light the grip on both controllers and lit it on %s" % [xr.countdownControllers])
	if not xr.withRoom:
		f.append("without augmented reality the room had to be visible")

	for failure in f:
		failures.append("%s: %s" % [c.name, failure])
	print("XR-CONTROLLER case «%s»: %d–%d, %d touches, %d pulses, rise %.3f (interface %.3f), turn %.3f, hints %s, %d µs on average%s" % [
		c.name, r.playerGoals, r.opponentGoals, r.playerHits, xr.vibrations, xr.rise, xr.ui, xr.turn, xr.hintsSeen, r.logicUsecAvg,
		"" if f.is_empty() else " — FAIL",
	])

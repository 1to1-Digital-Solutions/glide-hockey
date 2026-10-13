## The menu with the mouse, in the real scene: that it starts at the menu **with the challenge
## chosen** and playing without touching anything starts it with the goal sign in view, that
## choosing another mode and pressing play starts the match of that mode, that Escape asks before
## leaving it, that going back to the menu from the prompt goes back to the menu and that the arrow
## in the corner exits the game.
##
## The clicks are mouse events pushed into the viewport, over where the camera paints each button
## (`button_on_screen`): the same path as a real click, aim included. Pressing and releasing go in
## different frames, as with a hand: the press counts on pressing.
extends Node

const MAIN := "res://games/glide-hockey/main.tscn"
## If it has not finished within this, something has got stuck.
const MAX_FRAMES := 600

var game: Node
var frames := 0
var step := 0
var wait := 0
var failures: Array[String] = []
## A click in two beats: one frame presses and the next step releases.
var pressed_at := Vector2(-1, -1)


func _ready() -> void:
	# With no window, the engine paints at 64×64: with that aspect ratio, what on the flat screen
	# goes to one side of the table (the column) falls outside the image. It is played at a
	# screen's ratio, the project's.
	get_window().size = Vector2i(1152, 648)
	AudioServer.add_bus()
	var bus := AudioServer.bus_count - 1
	AudioServer.set_bus_name(bus, "Muted")
	AudioServer.set_bus_mute(bus, true)
	game = (load(MAIN) as PackedScene).instantiate()
	game.set_meta("harness_menu", true)
	game.set_meta("sfx_bus", "Muted")
	# What is checked of the menu and of the sign is in English: with no saved language, the game
	# would speak the system's.
	game.set_meta("ajustes", JSON.stringify({"xrcade:lang": "en"}))
	add_child(game)


func move_to(id: String) -> Vector2:
	var at: Vector2 = game.button_on_screen(id)
	if at.x < 0:
		failures.append("cannot find the button %s" % id)
	var e := InputEventMouseMotion.new()
	e.position = at
	get_viewport().push_input(e)
	return at


func mouse_button(at: Vector2, pressed: bool) -> void:
	var e := InputEventMouseButton.new()
	e.position = at
	e.button_index = MOUSE_BUTTON_LEFT
	e.pressed = pressed
	get_viewport().push_input(e)


func escape() -> void:
	var e := InputEventKey.new()
	e.keycode = KEY_ESCAPE
	e.pressed = true
	get_viewport().push_input(e)


func expect_phase(phase: String, what: String) -> void:
	if game.phase() != phase:
		failures.append("%s: the phase is %s and not %s" % [what, game.phase(), phase])


func _process(_delta: float) -> void:
	frames += 1
	if frames > MAX_FRAMES:
		failures.append("it has not finished in %d frames (step %d)" % [MAX_FRAMES, step])
		finish()
		return
	if wait > 0:
		wait -= 1
		return
	wait = 2
	match step:
		0:
			# The menu opens on the challenge: playing without touching anything starts the match
			# that gives a medal.
			expect_phase("menu", "on opening")
			if game.match_mode() != "challenge":
				failures.append("the menu opens on %s and not on the challenge" % game.match_mode())
			if game.sign_visible():
				failures.append("the goal sign is visible in the menu")
			pressed_at = move_to("play")
			mouse_button(pressed_at, true)
		1:
			mouse_button(pressed_at, false)
		2:
			expect_phase("countdown", "after pressing play without touching anything")
			if game.match_mode() != "challenge":
				failures.append("without touching anything %s is played and not the challenge" % game.match_mode())
			# And the goal, straight ahead from the countdown: the challenge's mission.
			if not game.sign_visible():
				failures.append("in the challenge the goal sign is not visible")
			if not game.goal_sign().begins_with("Win games until you lose one"):
				failures.append("the sign says «%s» and not the mission" % game.goal_sign())
			escape()
		3:
			expect_phase("prompt", "after Escape in the challenge")
			pressed_at = move_to("confirm:menu")
			mouse_button(pressed_at, true)
		4:
			mouse_button(pressed_at, false)
		5:
			expect_phase("menu", "after leaving the challenge")
			pressed_at = move_to("mode levels")
			mouse_button(pressed_at, true)
		6:
			mouse_button(pressed_at, false)
			# The same button twice: a second touch in under 300 ms does not count (`Punteria`).
			OS.delay_msec(320)
		7:
			pressed_at = move_to("play")
			mouse_button(pressed_at, true)
		8:
			mouse_button(pressed_at, false)
		9:
			expect_phase("countdown", "after pressing play")
			if game.match_mode() != "levels":
				failures.append("%s is played and levels was chosen" % game.match_mode())
			# Outside the challenge and without the hall there is no medal to talk about: nothing is
			# hung.
			if game.sign_visible():
				failures.append("in the levels, without the hall, the goal sign is visible")
			escape()
		10:
			expect_phase("prompt", "after Escape in the match")
			pressed_at = move_to("confirm:menu")
			mouse_button(pressed_at, true)
		11:
			mouse_button(pressed_at, false)
		12:
			expect_phase("menu", "after going back to the menu from the prompt")
			pressed_at = move_to("exit")
			mouse_button(pressed_at, true)
		13:
			mouse_button(pressed_at, false)
		14:
			if not game.has_meta("salida"):
				failures.append("the exit arrow has not exited")
			finish()
			return
	step += 1


func finish() -> void:
	set_process(false)
	print("MENU-MOUSE %s %s" % ["ok" if failures.is_empty() else "FAIL", ", ".join(failures)])
	get_tree().quit(0 if failures.is_empty() else 1)

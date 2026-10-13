## An automatic match against the machine, whole and to the end, counting what happens: that the
## table of `src/lib` and the scene are stitched together (goals on both sides, the scoreboard and
## the points of the web), that what should sound does, and as many times as it should, that the
## goal against is a hit taken, that the puck sounds as it slides and that at the end the result is
## told to the hall. With no real audio: everything goes to a muted bus, which counts the same.
##
## And the challenge contract: with a hall that lends a seed (`challenge_seed`), the game goes
## straight into the challenge with the machine's shots drawn from it. If it also leaves the
## cabinet's thresholds (`goal`), the sign above the scoreboard says them; without them, only the
## mission.
##
## And the two-player duel, whole (`duel.ts`): the automatic player plays the first one's match,
## stays at the handover, presses play for the second one's and finishes. Both against the same
## machine —the same seed and what `DUEL_SETUP` dictates—, with no record and no notice to the
## hall, with whoever wins by margin, written down on the pair's tally, and the ending sounding
## like a win.
##
## It is launched with `--fixed-fps 72`, like the automatic player.
extends Node

const MAIN := "res://games/glide-hockey/main.tscn"
const SALON := preload("res://games/glide-hockey/tests/fake_salon.gd")
## The strikes and bounces, at three strengths each; with noise, so with variants.
const IMPACTS := ["strike-suave", "strike-medio", "strike-fuerte", "bounce-suave", "bounce-medio", "bounce-fuerte"]
const ENDINGS := ["goal", "win", "loss", "record"]
## The web's music (`MUSIC_VOLUME`) times the hall's starting ambience (60 out of 100).
const MUSIC_VOLUME := 0.22 * 0.6
## The automatic player's match lasts under a minute of play: at three, something has got stuck.
const MAX_FRAMES := 72 * 180
## Any seed for the challenge.
const SEED := 20260926
## What the hall leaves in the `goal` metadata of its autoload: the cabinet's thresholds.
const GOAL := {"medallas": {"bronce": 111, "plata": 222, "oro": 333}, "mejorEs": "mas", "unidad": "points in the challenge", "record": null, "modo": "challenge"}
## The game's feats, in the order they are told (`FEATS` of `feats.ts`).
const FEATS := ["GH_SHUTOUT", "GH_LONG_SHOT", "GH_OWN_GOAL"]
## What the duel dictates (`DUEL_SETUP` of `duel.ts`): up to how many goals.
const DUEL_GOALS := 7

var game: Node
var salon: Node
var frames := 0
var failures: Array[String] = []
var stage := "match"


func _ready() -> void:
	AudioServer.add_bus()
	var bus := AudioServer.bus_count - 1
	AudioServer.set_bus_name(bus, "Muted")
	AudioServer.set_bus_mute(bus, true)
	mount()


func mount(duel := false) -> void:
	frames = 0
	game = (load(MAIN) as PackedScene).instantiate()
	game.set_meta("harness", true)
	if duel:
		game.set_meta("duel", true)
	game.set_meta("sfx_bus", "Muted")
	add_child(game)


func _process(_delta: float) -> void:
	frames += 1
	if stage == "match":
		if game.has_meta("result"):
			check(JSON.parse_string(game.get_meta("result")))
			start_challenge()
		elif frames > MAX_FRAMES:
			failures.append("the match has not ended in %d frames" % MAX_FRAMES)
			finish()
	elif stage == "challenge" and frames > 10:
		check_challenge(false)
		start_challenge(true)
	elif stage == "thresholds" and frames > 10:
		check_challenge(true)
		start_duel()
	elif stage == "duel":
		if game.has_meta("result"):
			check_duel(JSON.parse_string(game.get_meta("result")))
			finish()
		elif frames > MAX_FRAMES * 2:
			failures.append("the duel has not ended in %d frames" % (MAX_FRAMES * 2))
			finish()


func count(from: Dictionary, key: String) -> int:
	return int(from.get(key, 0))


func check(r: Dictionary) -> void:
	var requested: Dictionary = r.sfx.requested
	var played: Dictionary = r.sfx.played
	var player := int(r.playerGoals)
	var opponent := int(r.opponentGoals)
	if r.outcome == null:
		failures.append("the match has not ended")
	if player + opponent != int(r.goals):
		failures.append("the scoreboard %d–%d does not add up to the table's %d goals" % [player, opponent, r.goals])
	if player == 0 or opponent == 0:
		failures.append("goals are needed on both sides and it ended %d–%d" % [player, opponent])
	if (r.outcome == "won") != (player > opponent):
		failures.append("it ends «%s» with %d–%d" % [r.outcome, player, opponent])
	if int(r.playerHits) == 0:
		failures.append("the player's mallet has not touched the puck")
	if int(r.points) <= 0:
		failures.append("the match ends with %d points" % r.points)

	for key in IMPACTS + ENDINGS:
		if int(r.variants[key]) < 1:
			failures.append("%s has no file" % key)
		if count(played, key) != count(requested, key):
			failures.append("%s: requested %d, played %d" % [key, count(requested, key), count(played, key)])
	for key in IMPACTS:
		if int(r.variants[key]) < 3:
			failures.append("%s has %d variants and it carries noise" % [key, r.variants[key]])
	var strikes := 0
	var bounces := 0
	for key in IMPACTS:
		if key.begins_with("strike"):
			strikes += count(requested, key)
		else:
			bounces += count(requested, key)
	if strikes == 0 or bounces == 0:
		failures.append("no strikes (%d) or no bounces (%d) are heard" % [strikes, bounces])
	if count(requested, "goal") != int(r.goals):
		failures.append("%d goals called for %d goals" % [count(requested, "goal"), r.goals])
	var ending := "win" if player > opponent else "loss"
	if count(requested, ending) != 1 or count(requested, "win") + count(requested, "loss") != 1:
		failures.append("the ending is not a «%s»: %s" % [ending, requested])
	if count(requested, "record") != (1 if r.record else 0):
		failures.append("the record sounds %d times with record=%s" % [count(requested, "record"), r.record])

	# The goal against is a hit taken, with the starting comfort (full).
	if int(r.hitsTaken) != opponent:
		failures.append("%d hits taken for %d goals against" % [r.hitsTaken, opponent])
	# And the result is told to the hall once, without being the challenge.
	if r.results.size() != 1 or r.results[0].mode != "practice" or r.results[0].challenge:
		failures.append("the hall is told %s" % [r.results])
	else:
		# With the match's feats (`feats.ts`): the ones the table gave and, winning without
		# conceding, the match's own. The test scene's save starts empty, so all of them are
		# earned for the first time.
		var expected: Array = []
		for key in FEATS:
			var from_table: bool = r.tableFeats.has(key)
			var from_match: bool = key == "GH_SHUTOUT" and r.outcome == "won" and opponent == 0
			if from_table or from_match:
				expected.append(key)
		var reported: Array = r.results[0].get("feats", [])
		if reported != expected:
			failures.append("the hall is told the feats %s and the match gave %s" % [reported, expected])
	# The puck's slide: it sounds while playing, with the volume and the pitch of the speed. The
	# loop was rendered at top speed, so neither the volume nor the pitch goes above 1, and over
	# a whole match the puck goes at several speeds, so the pitch moves.
	var slide: Dictionary = r.slide
	if int(slide.frames) < 72:
		failures.append("the puck barely sounds as it slides: %s" % [slide])
	if float(slide.maxVolume) < 0.2 or float(slide.maxVolume) > 1.0001:
		failures.append("the slide reaches a volume of %.3f" % float(slide.maxVolume))
	if float(slide.maxPitch) > 1.0001 or float(slide.minPitch) < 0.19 or float(slide.maxPitch) - float(slide.minPitch) < 0.1:
		failures.append("the pitch of the slide does not follow the speed: %s" % [slide])
	if not r.music.playing or absf(float(r.music.volume) - MUSIC_VOLUME) > 0.001:
		failures.append("the music is not playing at %.3f: %s" % [MUSIC_VOLUME, r.music])
	print("AUTO-RUN %d–%d, %d touches, %d points, %d frames, %d µs on average (%d at peak), feats %s" % [
		player, opponent, r.playerHits, r.points, r.frames, r.logicUsecAvg, r.logicUsecMax, r.tableFeats,
	])


func start_challenge(with_thresholds := false) -> void:
	game.queue_free()
	if salon != null:
		# Out of the tree right now, not at the end of the frame: the new scene would look for the
		# old hall.
		salon.get_parent().remove_child(salon)
		salon.queue_free()
	stage = "thresholds" if with_thresholds else "challenge"
	salon = SALON.new()
	salon.name = "XRcade"
	salon.set_meta("challenge_seed", SEED)
	if with_thresholds:
		salon.set_meta("goal", JSON.stringify(GOAL))
	get_tree().root.add_child(salon)
	mount()


func check_challenge(with_thresholds: bool) -> void:
	# The sign above the scoreboard: with the hall's thresholds it says them; without them, only the
	# mission.
	var sign_text: String = game.goal_sign()
	var says_thresholds := sign_text.contains("111") and sign_text.contains("222") and sign_text.contains("333")
	if sign_text == "":
		failures.append("in the hall's challenge there is no goal sign (thresholds: %s)" % with_thresholds)
	elif with_thresholds and not says_thresholds:
		failures.append("with the hall's `goal` the sign does not say the thresholds: «%s»" % sign_text)
	elif not with_thresholds and says_thresholds:
		failures.append("without the hall's `goal` the sign says thresholds: «%s»" % sign_text)
	print("AUTO-RUN challenge %s: «%s»" % ["with thresholds" if with_thresholds else "without thresholds", sign_text])
	if game.match_mode() != "challenge":
		failures.append("with the hall's seed %s is played and not the challenge" % game.match_mode())
	if not game.in_challenge():
		failures.append("with the hall's seed the match is not the challenge")
	if game.phase() == "menu":
		failures.append("with the hall's challenge you go straight into play, not to the menu")


func start_duel() -> void:
	game.queue_free()
	# Without the hall: the duel is not a challenge, and with the hall's seed it would go into the
	# challenge. Out of the tree right now, not at the end of the frame: the new scene would look
	# for it first.
	salon.get_parent().remove_child(salon)
	salon.queue_free()
	salon = null
	stage = "duel"
	mount(true)


func check_duel(r: Dictionary) -> void:
	var duel = r.duel
	if duel == null:
		failures.append("the duel was not played as a duel: %s" % r.mode)
		return
	var matches: Array = duel.playedMatches
	if matches.size() != 2:
		failures.append("the duel has %d matches and not two" % matches.size())
		return
	if not duel.over or duel.next != null:
		failures.append("the duel has not ended: %s" % [duel])
	# Both against the same machine: the same seed and up to the duel's goals.
	if int(matches[0].seed) != int(matches[1].seed):
		failures.append("the machine plays each one with a different seed: %s and %s" % [matches[0].seed, matches[1].seed])
	for i in 2:
		var p: Dictionary = matches[i]
		if maxi(int(p.scored), int(p.conceded)) != DUEL_GOALS:
			failures.append("match %d ends %d–%d and the duel is up to %d" % [i + 1, p.scored, p.conceded, DUEL_GOALS])
		var recorded: Dictionary = duel.matches[i]
		if int(recorded.scored) != int(p.scored) or int(recorded.conceded) != int(p.conceded):
			failures.append("match %d is written down as %s and it ended %s" % [i + 1, recorded, p])
	# The same automatic player against the same machine gets the same: it is what the shared
	# seed promises (within one platform; see «What is known» in the README).
	if int(matches[0].scored) != int(matches[1].scored) or int(matches[0].conceded) != int(matches[1].conceded):
		failures.append("the same player against the same machine ends %s and %s" % [matches[0], matches[1]])
	# Whoever gets the bigger margin over the machine wins; with the same one, a tie.
	var margin := func(p: Dictionary) -> int: return int(p.scored) - int(p.conceded)
	var difference: int = margin.call(matches[0]) - margin.call(matches[1])
	var winner = null if difference == 0 else (0 if difference > 0 else 1)
	if duel.winner != winner:
		failures.append("%s wins with margins %d and %d" % [duel.winner, margin.call(matches[0]), margin.call(matches[1])])
	var tally: Dictionary = duel.tally
	var expected_wins := [0, 0]
	var ties := 0
	if winner == null:
		ties = 1
	else:
		expected_wins[winner] = 1
	if int(tally.wins[0]) != expected_wins[0] or int(tally.wins[1]) != expected_wins[1] or int(tally.ties) != ties:
		failures.append("the pair's tally ends up %s" % [tally])
	# No record and no notice to the hall: the goals belong to two people.
	if r.record or int(r.best) != 0 or not r.results.is_empty():
		failures.append("the duel leaves a record (%s, %s) or notifies the hall: %s" % [r.record, r.best, r.results])
	# Two endings: the first one's sounds like how it went, the duel's like a win.
	var endings: Array = r.endings
	var first := "win" if int(matches[0].scored) > int(matches[0].conceded) else "loss"
	if endings != [first, "win"]:
		failures.append("the duel's endings are %s and not [%s, win]" % [endings, first])
	print("AUTO-RUN duel %d–%d and %d–%d, winner %s, seed %d" % [
		matches[0].scored, matches[0].conceded, matches[1].scored, matches[1].conceded, duel.winner, matches[0].seed,
	])


func finish() -> void:
	set_process(false)
	if salon != null:
		salon.queue_free()
	print("AUTO-RUN %s %s" % ["ok" if failures.is_empty() else "FAIL", ", ".join(failures)])
	get_tree().quit(0 if failures.is_empty() else 1)

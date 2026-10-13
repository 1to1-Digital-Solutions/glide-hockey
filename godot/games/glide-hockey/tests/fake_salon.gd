## What the game sees of the hall when it is mounted in it (`xrcade.gd`), without the hall: the
## anchor it lends and, for the challenge contract, the seed (metadata `challenge_seed`) and where
## it is told the results (`report_result`). The test scene hangs it at `/root/XRcade` before
## mounting the game.
extends Node

var anchor_lent := true
var anchor_position := Vector3.ZERO
var anchor_yaw := 0.0
var results: Array = []


func exit_to_hub() -> void:
	pass


func report_result(json: String) -> void:
	results.append(JSON.parse_string(json))

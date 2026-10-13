## Lo que el juego ve del salón cuando está montado en él (`xrcade.gd`), sin el salón: el anclaje
## que presta y, para el contrato del reto, la semilla (metadato `challenge_seed`) y dónde se le
## cuentan los resultados (`report_result`). La escena de test lo cuelga en `/root/XRcade` antes de
## montar el juego.
extends Node

var anchor_lent := true
var anchor_position := Vector3.ZERO
var anchor_yaw := 0.0
var resultados: Array = []


func exit_to_hub() -> void:
	pass


func report_result(json: String) -> void:
	resultados.append(JSON.parse_string(json))

## Glide Hockey con visor, sin visor: mandos de mentira (`@kit/runtime/xr/simulado`) y el jugador
## automático que coge el mazo con la mano y juega una partida entera moviéndola por la mesa, por
## el mismo camino que una mano de verdad. Cada caso monta el juego de nuevo con sus ajustes del
## salón y comprueba la gramática XR del kit con los ficheros comunes de verdad del juego
## (`uiHeight.ts`, `hostAnchor.ts`, `agarre.ts`, `tactos.ts`):
##
## - el mazo lo coge la mano buena del guardado (`xrcade:hand`), y la cuenta atrás lo espera: sin
##   mazo en la mano no se saca;
## - sentado a los ojos el mundo baja lo que los ojos bajan de 1,6 m; de pie, nada;
## - con salón, la mesa se planta donde presta el anclaje; sin él, a los pies y de frente;
## - el stick de la otra mano gira el decorado 30° sentado, y de pie no;
## - vibra en la mano que lleva el mazo, y solo en ella: los golpes al disco, los goles y el final
##   (y el golpe recibido del gol en contra, que va a las dos).
##
## Se lanza con `--fixed-fps 72`, como el jugador automático.
extends Node

const MAIN := "res://games/glide-hockey/main.tscn"
const SALON := preload("res://games/glide-hockey/tests/salon_de_mentira.gd")
const REFERENCIA := 1.6
const PASO_DE_GIRO := PI / 6
const MAX_FRAMES := 72 * 180

const CASOS := [
	{
		"nombre": "diestro sentado en el salón",
		"ajustes": {"xrcade:hand": "right", "xrcade:play-height": "eyes"},
		"ojos": 1.15,
		"anclaje": {"position": Vector3(0.3, 0.0, -0.2), "yaw": 0.25},
		"gira": true,
	},
	{
		"nombre": "zurdo de pie, con un toque, sin salón",
		"ajustes": {"xrcade:hand": "left", "xrcade:play-height": "standing", "xrcade:grab": "toggle"},
		"ojos": 1.7,
		"anclaje": null,
		"gira": false,
	},
]

var caso := -1
var game: Node
var salon: Node
var frames := 0
var fallos: Array[String] = []


func _ready() -> void:
	AudioServer.add_bus()
	var bus := AudioServer.bus_count - 1
	AudioServer.set_bus_name(bus, "Mudo")
	AudioServer.set_bus_mute(bus, true)
	siguiente()


func siguiente() -> void:
	if game != null:
		game.queue_free()
		game = null
	if salon != null:
		# Fuera ya, no al final del fotograma: el juego siguiente busca `/root/XRcade` al entrar.
		salon.get_parent().remove_child(salon)
		salon.free()
		salon = null
	caso += 1
	if caso >= CASOS.size():
		print("XR-MANDO %s %s" % ["ok" if fallos.is_empty() else "FAIL", "; ".join(fallos)])
		get_tree().quit(0 if fallos.is_empty() else 1)
		return
	var c: Dictionary = CASOS[caso]
	if c.anclaje != null:
		salon = SALON.new()
		salon.name = "XRcade"
		salon.anchor_position = c.anclaje.position
		salon.anchor_yaw = c.anclaje.yaw
		get_tree().root.add_child.call_deferred(salon)
	frames = 0
	game = (load(MAIN) as PackedScene).instantiate()
	game.set_meta("harness", true)
	game.set_meta("sfx_bus", "Mudo")
	game.set_meta("xr_simulado", true)
	game.set_meta("ojos", c.ojos)
	game.set_meta("ajustes", JSON.stringify(c.ajustes))
	add_child.call_deferred(game)


func _process(_delta: float) -> void:
	if game == null or not game.is_inside_tree():
		return
	frames += 1
	if game.has_meta("result"):
		comprobar(JSON.parse_string(game.get_meta("result")))
		siguiente()
	elif frames > MAX_FRAMES:
		fallos.append("%s: la partida no ha acabado en %d fotogramas (fase %s)" % [CASOS[caso].nombre, MAX_FRAMES, game.fase()])
		siguiente()


func cerca(a: float, b: float, margen := 1e-3) -> bool:
	return absf(a - b) <= margen


func comprobar(r: Dictionary) -> void:
	var c: Dictionary = CASOS[caso]
	var f: Array[String] = []
	var xr: Dictionary = r.xr
	var buena: String = c.ajustes["xrcade:hand"]

	if r.outcome == null or int(r.goals) == 0:
		f.append("la partida no ha acabado con goles (%s, %d goles)" % [r.outcome, r.goals])
	if int(r.playerHits) == 0:
		f.append("el mazo en la mano no ha tocado el disco")
	if xr.mano != buena or xr.llevaron != [buena]:
		f.append("el mazo lo han llevado %s y la mano buena es %s" % [xr.llevaron, buena])

	var subida: float = (c.ojos - REFERENCIA) if c.ajustes["xrcade:play-height"] == "eyes" else 0.0
	if not cerca(float(xr.subida), subida):
		f.append("el mundo ha subido %.3f y tenía que subir %.3f" % [xr.subida, subida])

	var colocacion: Dictionary = xr.colocacion
	if c.anclaje != null:
		if not (cerca(colocacion.x, c.anclaje.position.x) and cerca(colocacion.z, c.anclaje.position.z) and cerca(colocacion.yaw, c.anclaje.yaw)):
			f.append("plantado en %s y el salón prestaba %s" % [colocacion, c.anclaje])
	elif not (cerca(colocacion.x, 0.0) and cerca(colocacion.z, 0.0) and cerca(colocacion.yaw, 0.0)):
		f.append("sin salón tenía que plantarse a los pies y de frente: %s" % colocacion)

	var giro: float = PASO_DE_GIRO if c.gira else 0.0
	if not cerca(float(xr.giro), giro):
		f.append("girado %.3f y tocaba %.3f" % [xr.giro, giro])

	if int(xr.vibraciones) == 0:
		f.append("no ha vibrado nada")
	var otra := "left" if buena == "right" else "right"
	# La otra mano solo vibra con el golpe recibido, que es del cuerpo y va a las dos.
	if otra in xr.manosQueVibraron and int(r.golpesRecibidos) == 0:
		f.append("ha vibrado la mano %s, que no lleva el mazo" % otra)

	for fallo in f:
		fallos.append("%s: %s" % [c.nombre, fallo])
	print("XR-MANDO caso «%s»: %d–%d, %d toques, %d pulsos, subida %.3f, giro %.3f%s" % [
		c.nombre, r.playerGoals, r.opponentGoals, r.playerHits, xr.vibraciones, xr.subida, xr.giro,
		"" if f.is_empty() else " — FAIL",
	])

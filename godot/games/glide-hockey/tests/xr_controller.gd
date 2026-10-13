## Glide Hockey con visor, sin visor: mandos de mentira (`@kit/runtime/xr/simulated`) y el jugador
## automático que coge el mazo con la mano y juega una partida entera moviéndola por la mesa, por
## el mismo camino que una mano de verdad. Cada caso monta el juego de nuevo con sus ajustes del
## salón y comprueba la gramática XR del kit con los ficheros comunes de verdad del juego
## (`uiHeight.ts`, `hostAnchor.ts`, `agarre.ts`, `tactos.ts`):
##
## - el mazo lo coge la mano buena del guardado (`xrcade:hand`), y la cuenta atrás lo espera: sin
##   mazo en la mano no se saca;
## - sentado a los ojos el mundo baja lo que los ojos bajan de 1,6 m; de pie, nada; y la interfaz
##   sube sobre el mundo lo que le falta para quedar a los ojos (`uiRiseOverWorld`, el `XRUiHeight`
##   de la web);
## - con salón, la mesa se planta donde presta el anclaje; sin él, a los pies y de frente;
## - el stick de la otra mano gira el decorado 30° sentado, y de pie no;
## - vibra en la mano que lleva el mazo, y solo en ella: los golpes al disco, los goles y el final
##   (y el golpe recibido del gol en contra, que va a las dos);
## - se ven las cuatro ayudas del guion de la web —las huellas, el mando de verdad junto al mazo
##   fantasma, el fantasma y la marca de la portería— y al acabar ninguna; el tutorial sale, con el
##   mando de verdad en las dos manos; quien tarda en coger el mazo ve el agarre encendido en los
##   dos mandos mientras la cuenta lo espera; y sin realidad aumentada, alrededor está la sala.
##
## Se lanza con `--fixed-fps 72`, como el jugador automático.
extends Node

const MAIN := "res://games/glide-hockey/main.tscn"
const SALON := preload("res://games/glide-hockey/tests/fake_salon.gd")
const REFERENCIA := 1.6
const PASO_DE_GIRO := PI / 6
const MAX_FRAMES := 72 * 180
const PERFIL_DE_OPENXR := "/interaction_profiles/oculus/touch_controller"
const AYUDAS := ["suelo", "mando", "gesto", "porteria"]

const CASOS := [
	{
		"nombre": "diestro sentado en el salón",
		"ajustes": {"xrcade:hand": "right", "xrcade:play-height": "eyes"},
		"ojos": 1.15,
		"anclaje": {"position": Vector3(0.3, 0.0, -0.2), "yaw": 0.25},
		"gira": true,
		"coge_tarde": true,
	},
	{
		"nombre": "zurdo de pie, con un toque, sin salón",
		"ajustes": {"xrcade:hand": "left", "xrcade:play-height": "standing", "xrcade:grab": "toggle", "xrcade:play-height-offset": "-15"},
		"ojos": 1.7,
		"anclaje": null,
		"gira": false,
		"coge_tarde": false,
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
	if c.coge_tarde:
		game.set_meta("coge_tarde", true)
	add_child.call_deferred(game)


func _process(_delta: float) -> void:
	if game == null or not game.is_inside_tree():
		return
	frames += 1
	# Los mandos de mentira llegan sin perfil: se les pone el de los de Quest, como haría el visor.
	for mano in ["left_hand", "right_hand"]:
		var tracker := XRServer.get_tracker(mano) as XRPositionalTracker
		if tracker != null and tracker.profile != PERFIL_DE_OPENXR:
			tracker.profile = PERFIL_DE_OPENXR
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

	# La altura fina del salón (`xrcade:play-height-offset`, en centímetros) mueve el mundo y nada más.
	var aLosOjos: float = (c.ojos - REFERENCIA) if c.ajustes["xrcade:play-height"] == "eyes" else 0.0
	var subida: float = aLosOjos + float(c.ajustes.get("xrcade:play-height-offset", "0")) / 100.0
	if not cerca(float(xr.subida), subida):
		f.append("el mundo ha subido %.3f y tenía que subir %.3f" % [xr.subida, subida])

	# El mando junto al mazo fantasma es el de la mano buena, y de su lado del mazo.
	var junto: Dictionary = xr.mandoJunto
	if junto.mano != buena or (float(junto.x) > 0.0) != (buena == "right"):
		f.append("el mando junto al mazo es el %s en x = %.3f y la mano buena es %s" % [junto.mano, junto.x, buena])

	var interfaz: float = (c.ojos - REFERENCIA) - aLosOjos
	if not cerca(float(xr.subidaDeLaInterfaz), interfaz):
		f.append("la interfaz sube %.3f sobre el mundo y tenía que subir %.3f" % [xr.subidaDeLaInterfaz, interfaz])

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

	for ayuda in AYUDAS:
		if not ayuda in xr.ayudas:
			f.append("la ayuda «%s» no se ha visto (se vieron %s)" % [ayuda, xr.ayudas])
	if not xr.ayudasAlFinal.is_empty():
		f.append("al acabar siguen a la vista %s" % [xr.ayudasAlFinal])
	if not xr.tutorial:
		f.append("el tutorial no ha salido")
	if not ("left" in xr.mandosDelTutorial and "right" in xr.mandosDelTutorial):
		f.append("el mando de verdad del tutorial ha salido en %s y tenía que salir en las dos" % [xr.mandosDelTutorial])
	if c.coge_tarde and not ("left" in xr.mandosDeLaCuenta and "right" in xr.mandosDeLaCuenta):
		f.append("la cuenta parada tenía que encender el agarre en los dos mandos y lo encendió en %s" % [xr.mandosDeLaCuenta])
	if not xr.conSala:
		f.append("sin realidad aumentada tenía que verse la sala")

	for fallo in f:
		fallos.append("%s: %s" % [c.nombre, fallo])
	print("XR-MANDO caso «%s»: %d–%d, %d toques, %d pulsos, subida %.3f (interfaz %.3f), giro %.3f, ayudas %s, %d µs de media%s" % [
		c.nombre, r.playerGoals, r.opponentGoals, r.playerHits, xr.vibraciones, xr.subida, xr.subidaDeLaInterfaz, xr.giro, xr.ayudas, r.logicUsecAvg,
		"" if f.is_empty() else " — FAIL",
	])

## El menú con el ratón, en la escena de verdad: que se empieza en el menú **con el reto elegido** y
## jugar sin tocar nada lo empieza con el cartel del objetivo a la vista, que elegir otro modo y
## darle a jugar empieza la partida de ese modo, que Escape pregunta antes de dejarla, que volver al
## menú desde el aviso vuelve al menú y que la flecha de la esquina sale del juego.
##
## Los clics son eventos del ratón empujados al viewport, sobre donde la cámara pinta cada botón
## (`pantalla_del_boton`): el mismo camino que un clic de verdad, puntería incluida. Apretar y
## soltar van en fotogramas distintos, como con una mano: la pulsación cuenta al apretar.
extends Node

const MAIN := "res://games/glide-hockey/main.tscn"
## Si en esto no ha acabado, algo se ha atascado.
const MAX_FRAMES := 600

var game: Node
var frames := 0
var paso := 0
var espera := 0
var failures: Array[String] = []
## Un clic en dos tiempos: un fotograma aprieta y el siguiente paso suelta.
var apretado_en := Vector2(-1, -1)


func _ready() -> void:
	# Sin ventana, el motor pinta en 64×64: con esa proporción, lo que en plano va a un lado de la
	# mesa (la columna) cae fuera de la imagen. Se juega en la de una pantalla, la del proyecto.
	get_window().size = Vector2i(1152, 648)
	AudioServer.add_bus()
	var bus := AudioServer.bus_count - 1
	AudioServer.set_bus_name(bus, "Mudo")
	AudioServer.set_bus_mute(bus, true)
	game = (load(MAIN) as PackedScene).instantiate()
	game.set_meta("harness_menu", true)
	game.set_meta("sfx_bus", "Mudo")
	add_child(game)


func mover(id: String) -> Vector2:
	var at: Vector2 = game.pantalla_del_boton(id)
	if at.x < 0:
		failures.append("no encuentro el botón %s" % id)
	var e := InputEventMouseMotion.new()
	e.position = at
	get_viewport().push_input(e)
	return at


func boton(at: Vector2, apretado: bool) -> void:
	var e := InputEventMouseButton.new()
	e.position = at
	e.button_index = MOUSE_BUTTON_LEFT
	e.pressed = apretado
	get_viewport().push_input(e)


func escape() -> void:
	var e := InputEventKey.new()
	e.keycode = KEY_ESCAPE
	e.pressed = true
	get_viewport().push_input(e)


func esperar(fase: String, que: String) -> void:
	if game.fase() != fase:
		failures.append("%s: la fase es %s y no %s" % [que, game.fase(), fase])


func _process(_delta: float) -> void:
	frames += 1
	if frames > MAX_FRAMES:
		failures.append("no ha acabado en %d fotogramas (paso %d)" % [MAX_FRAMES, paso])
		terminar()
		return
	if espera > 0:
		espera -= 1
		return
	espera = 2
	match paso:
		0:
			# El menú abre en el reto: jugar sin tocar nada empieza la partida que da medalla.
			esperar("menu", "al abrir")
			if game.modo_de_la_partida() != "challenge":
				failures.append("el menú abre en %s y no en el reto" % game.modo_de_la_partida())
			if game.cartel_visible():
				failures.append("el cartel del objetivo se ve en el menú")
			apretado_en = mover("jugar")
			boton(apretado_en, true)
		1:
			boton(apretado_en, false)
		2:
			esperar("countdown", "tras darle a jugar sin tocar nada")
			if game.modo_de_la_partida() != "challenge":
				failures.append("sin tocar nada se juega %s y no el reto" % game.modo_de_la_partida())
			# Y el objetivo, de frente desde la cuenta atrás: la misión del reto.
			if not game.cartel_visible():
				failures.append("en el reto no se ve el cartel del objetivo")
			if not game.cartel_dice().begins_with("Win games until you lose one"):
				failures.append("el cartel dice «%s» y no la misión" % game.cartel_dice())
			escape()
		3:
			esperar("aviso", "tras Escape en el reto")
			apretado_en = mover("confirm:menu")
			boton(apretado_en, true)
		4:
			boton(apretado_en, false)
		5:
			esperar("menu", "tras dejar el reto")
			apretado_en = mover("modo levels")
			boton(apretado_en, true)
		6:
			boton(apretado_en, false)
			# El mismo botón dos veces: un segundo roce en menos de 300 ms no cuenta (`Punteria`).
			OS.delay_msec(320)
		7:
			apretado_en = mover("jugar")
			boton(apretado_en, true)
		8:
			boton(apretado_en, false)
		9:
			esperar("countdown", "tras darle a jugar")
			if game.modo_de_la_partida() != "levels":
				failures.append("se juega %s y se eligió levels" % game.modo_de_la_partida())
			# Fuera del reto y sin salón no hay medalla de la que hablar: no se cuelga nada.
			if game.cartel_visible():
				failures.append("en los niveles, sin salón, se ve el cartel del objetivo")
			escape()
		10:
			esperar("aviso", "tras Escape en la partida")
			apretado_en = mover("confirm:menu")
			boton(apretado_en, true)
		11:
			boton(apretado_en, false)
		12:
			esperar("menu", "tras volver al menú desde el aviso")
			apretado_en = mover("salir")
			boton(apretado_en, true)
		13:
			boton(apretado_en, false)
		14:
			if not game.has_meta("salida"):
				failures.append("la flecha de salir no ha salido")
			terminar()
			return
	paso += 1


func terminar() -> void:
	set_process(false)
	print("MENU-RATON %s %s" % ["ok" if failures.is_empty() else "FAIL", ", ".join(failures)])
	get_tree().quit(0 if failures.is_empty() else 1)

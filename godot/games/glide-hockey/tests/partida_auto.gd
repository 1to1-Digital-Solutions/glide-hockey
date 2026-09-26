## Una partida automática contra la máquina, entera y hasta el final, contando lo que pasa: que la
## mesa de `src/lib` y la escena están cosidas (goles de los dos lados, el marcador y los puntos de
## la web), que suena lo que toca y tantas veces como toca, que el gol en contra es un golpe
## recibido y que al acabar se cuenta el resultado al salón. Sin audio de verdad: todo va a un bus
## silenciado, que cuenta igual.
##
## Y el contrato del reto: con un salón que presta una semilla (`challenge_seed`), el juego entra
## directo en el reto con los tiros de la máquina sacados de ella.
##
## Se lanza con `--fixed-fps 72`, como el jugador automático.
extends Node

const MAIN := "res://games/glide-hockey/main.tscn"
const SALON := preload("res://games/glide-hockey/tests/salon_de_mentira.gd")
## Los golpes y rebotes, a tres fuerzas cada uno; con ruido, así que con variantes.
const CHOQUES := ["strike-suave", "strike-medio", "strike-fuerte", "bounce-suave", "bounce-medio", "bounce-fuerte"]
const CIERRES := ["goal", "win", "loss", "record"]
## La música de la web (`MUSIC_VOLUME`) por el ambiente de partida del salón (60 de 100).
const MUSIC_VOLUME := 0.22 * 0.6
## La partida del jugador automático dura menos de un minuto de juego: con tres, algo se ha atascado.
const MAX_FRAMES := 72 * 180
## Una semilla cualquiera para el reto.
const SEMILLA := 20260926

var game: Node
var salon: Node
var frames := 0
var fallos: Array[String] = []
var fase := "partida"


func _ready() -> void:
	AudioServer.add_bus()
	var bus := AudioServer.bus_count - 1
	AudioServer.set_bus_name(bus, "Mudo")
	AudioServer.set_bus_mute(bus, true)
	montar()


func montar() -> void:
	frames = 0
	game = (load(MAIN) as PackedScene).instantiate()
	game.set_meta("harness", true)
	game.set_meta("sfx_bus", "Mudo")
	add_child(game)


func _process(_delta: float) -> void:
	frames += 1
	if fase == "partida":
		if game.has_meta("result"):
			comprobar(JSON.parse_string(game.get_meta("result")))
			empezar_el_reto()
		elif frames > MAX_FRAMES:
			fallos.append("la partida no ha acabado en %d fotogramas" % MAX_FRAMES)
			terminar()
	elif fase == "reto" and frames > 10:
		comprobar_el_reto()
		terminar()


func cuenta(de: Dictionary, nombre: String) -> int:
	return int(de.get(nombre, 0))


func comprobar(r: Dictionary) -> void:
	var pedidos: Dictionary = r.sfx.requested
	var sonados: Dictionary = r.sfx.played
	var jugador := int(r.playerGoals)
	var maquina := int(r.opponentGoals)
	if r.outcome == null:
		fallos.append("la partida no ha acabado")
	if jugador + maquina != int(r.goals):
		fallos.append("el marcador %d–%d no cuenta los %d goles de la mesa" % [jugador, maquina, r.goals])
	if jugador == 0 or maquina == 0:
		fallos.append("hacen falta goles de los dos lados y ha acabado %d–%d" % [jugador, maquina])
	if (r.outcome == "won") != (jugador > maquina):
		fallos.append("acaba «%s» con %d–%d" % [r.outcome, jugador, maquina])
	if int(r.playerHits) == 0:
		fallos.append("el mazo del jugador no ha tocado el disco")
	if int(r.points) <= 0:
		fallos.append("la partida acaba con %d puntos" % r.points)

	for nombre in CHOQUES + CIERRES:
		if int(r.variants[nombre]) < 1:
			fallos.append("%s no tiene fichero" % nombre)
		if cuenta(sonados, nombre) != cuenta(pedidos, nombre):
			fallos.append("%s: pedido %d, sonado %d" % [nombre, cuenta(pedidos, nombre), cuenta(sonados, nombre)])
	for nombre in CHOQUES:
		if int(r.variants[nombre]) < 3:
			fallos.append("%s tiene %d variantes y lleva ruido" % [nombre, r.variants[nombre]])
	var golpes := 0
	var rebotes := 0
	for nombre in CHOQUES:
		if nombre.begins_with("strike"):
			golpes += cuenta(pedidos, nombre)
		else:
			rebotes += cuenta(pedidos, nombre)
	if golpes == 0 or rebotes == 0:
		fallos.append("no suenan golpes (%d) o rebotes (%d)" % [golpes, rebotes])
	if cuenta(pedidos, "goal") != int(r.goals):
		fallos.append("%d goles cantados para %d goles" % [cuenta(pedidos, "goal"), r.goals])
	var cierre := "win" if jugador > maquina else "loss"
	if cuenta(pedidos, cierre) != 1 or cuenta(pedidos, "win") + cuenta(pedidos, "loss") != 1:
		fallos.append("el cierre no es un «%s»: %s" % [cierre, pedidos])
	if cuenta(pedidos, "record") != (1 if r.record else 0):
		fallos.append("la marca suena %d veces con record=%s" % [cuenta(pedidos, "record"), r.record])

	# El gol en contra es un golpe recibido, con el confort de partida (entero).
	if int(r.golpesRecibidos) != maquina:
		fallos.append("%d golpes recibidos para %d goles en contra" % [r.golpesRecibidos, maquina])
	# Y el resultado se le cuenta al salón una vez, sin ser el reto.
	if r.resultados.size() != 1 or r.resultados[0].modo != "practice" or r.resultados[0].reto:
		fallos.append("al salón se le cuenta %s" % [r.resultados])
	if not r.music.playing or absf(float(r.music.volume) - MUSIC_VOLUME) > 0.001:
		fallos.append("la música no está sonando a %.3f: %s" % [MUSIC_VOLUME, r.music])
	print("PARTIDA-AUTO %d–%d, %d toques, %d puntos, %d fotogramas, %d µs de media (%d de pico)" % [
		jugador, maquina, r.playerHits, r.points, r.frames, r.logicUsecAvg, r.logicUsecMax,
	])


func empezar_el_reto() -> void:
	game.queue_free()
	fase = "reto"
	salon = SALON.new()
	salon.name = "XRcade"
	salon.set_meta("challenge_seed", SEMILLA)
	get_tree().root.add_child(salon)
	montar()


func comprobar_el_reto() -> void:
	if game.modo_de_la_partida() != "challenge":
		fallos.append("con la semilla del salón se juega %s y no el reto" % game.modo_de_la_partida())
	if not game.en_reto():
		fallos.append("con la semilla del salón la partida no es el reto")
	if game.fase() == "menu":
		fallos.append("con el reto del salón se entra a jugar, no al menú")


func terminar() -> void:
	set_process(false)
	if salon != null:
		salon.queue_free()
	print("PARTIDA-AUTO %s %s" % ["ok" if fallos.is_empty() else "FAIL", ", ".join(fallos)])
	get_tree().quit(0 if fallos.is_empty() else 1)

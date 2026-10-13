## Una partida automática contra la máquina, entera y hasta el final, contando lo que pasa: que la
## mesa de `src/lib` y la escena están cosidas (goles de los dos lados, el marcador y los puntos de
## la web), que suena lo que toca y tantas veces como toca, que el gol en contra es un golpe
## recibido, que el disco suena al deslizar y que al acabar se cuenta el resultado al salón. Sin audio de verdad: todo va a un bus
## silenciado, que cuenta igual.
##
## Y el contrato del reto: con un salón que presta una semilla (`challenge_seed`), el juego entra
## directo en el reto con los tiros de la máquina sacados de ella. Si además deja los listones de la
## cabina (`goal`), el cartel de encima del marcador los dice; sin ellos, solo la misión.
##
## Y el duelo a dos, entero (`duel.ts`): el jugador automático juega la partida del primero, se queda
## en el traspaso, le da a jugar la del segundo y acaba. Las dos contra la misma máquina —la misma
## semilla y lo que manda `DUEL_SETUP`—, sin récord ni aviso al salón, con quien gana según la
## ventaja, apuntado en el marcador de la pareja, y el final sonando a ganar.
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
## Lo que el salón deja en el metadato `goal` de su autoload: los listones de la cabina.
const OBJETIVO := {"medallas": {"bronce": 111, "plata": 222, "oro": 333}, "mejorEs": "mas", "unidad": "points in the challenge", "record": null, "modo": "challenge"}
## Las hazañas del juego, en el orden en que se cuentan (`HAZANAS` de `hazanas.ts`).
const HAZANAS := ["GH_SHUTOUT", "GH_LONG_SHOT", "GH_OWN_GOAL"]
## Lo que manda el duelo (`DUEL_SETUP` de `duel.ts`): a cuántos goles.
const GOLES_DEL_DUELO := 7

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


func montar(duelo := false) -> void:
	frames = 0
	game = (load(MAIN) as PackedScene).instantiate()
	game.set_meta("harness", true)
	if duelo:
		game.set_meta("duelo", true)
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
		comprobar_el_reto(false)
		empezar_el_reto(true)
	elif fase == "listones" and frames > 10:
		comprobar_el_reto(true)
		empezar_el_duelo()
	elif fase == "duelo":
		if game.has_meta("result"):
			comprobar_el_duelo(JSON.parse_string(game.get_meta("result")))
			terminar()
		elif frames > MAX_FRAMES * 2:
			fallos.append("el duelo no ha acabado en %d fotogramas" % (MAX_FRAMES * 2))
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
	if r.resultados.size() != 1 or r.resultados[0].mode != "practice" or r.resultados[0].challenge:
		fallos.append("al salón se le cuenta %s" % [r.resultados])
	else:
		# Con las hazañas de la partida (`hazanas.ts`): las que dio la mesa y, ganando sin encajar, la
		# del partido. El guardado de la escena de test empieza vacío, así que todas se estrenan.
		var esperadas: Array = []
		for nombre in HAZANAS:
			var de_la_mesa: bool = r.hazanasDeLaMesa.has(nombre)
			var del_partido: bool = nombre == "GH_SHUTOUT" and r.outcome == "won" and maquina == 0
			if de_la_mesa or del_partido:
				esperadas.append(nombre)
		var contadas: Array = r.resultados[0].get("feats", [])
		if contadas != esperadas:
			fallos.append("al salón se le cuentan las hazañas %s y la partida dio %s" % [contadas, esperadas])
	# El roce del disco: suena mientras se juega, con el volumen y el tono de la velocidad. El bucle
	# se renderizó a la velocidad máxima, así que ni el volumen ni el tono pasan de 1, y en una
	# partida entera el disco va a varias velocidades, así que el tono se mueve.
	var roce: Dictionary = r.roce
	if int(roce.frames) < 72:
		fallos.append("el disco apenas suena al deslizar: %s" % [roce])
	if float(roce.maxVolume) < 0.2 or float(roce.maxVolume) > 1.0001:
		fallos.append("el roce llega a un volumen de %.3f" % float(roce.maxVolume))
	if float(roce.maxPitch) > 1.0001 or float(roce.minPitch) < 0.19 or float(roce.maxPitch) - float(roce.minPitch) < 0.1:
		fallos.append("el tono del roce no sigue a la velocidad: %s" % [roce])
	if not r.music.playing or absf(float(r.music.volume) - MUSIC_VOLUME) > 0.001:
		fallos.append("la música no está sonando a %.3f: %s" % [MUSIC_VOLUME, r.music])
	print("PARTIDA-AUTO %d–%d, %d toques, %d puntos, %d fotogramas, %d µs de media (%d de pico), hazañas %s" % [
		jugador, maquina, r.playerHits, r.points, r.frames, r.logicUsecAvg, r.logicUsecMax, r.hazanasDeLaMesa,
	])


func empezar_el_reto(con_listones := false) -> void:
	game.queue_free()
	if salon != null:
		# Fuera del árbol ya, no al final del fotograma: la escena nueva buscaría el salón viejo.
		salon.get_parent().remove_child(salon)
		salon.queue_free()
	fase = "listones" if con_listones else "reto"
	salon = SALON.new()
	salon.name = "XRcade"
	salon.set_meta("challenge_seed", SEMILLA)
	if con_listones:
		salon.set_meta("goal", JSON.stringify(OBJETIVO))
	get_tree().root.add_child(salon)
	montar()


func comprobar_el_reto(con_listones: bool) -> void:
	# El cartel de encima del marcador: con los listones del salón los dice; sin ellos, solo la misión.
	var cartel: String = game.cartel_dice()
	var dice_los_listones := cartel.contains("111") and cartel.contains("222") and cartel.contains("333")
	if cartel == "":
		fallos.append("en el reto del salón no hay cartel del objetivo (listones: %s)" % con_listones)
	elif con_listones and not dice_los_listones:
		fallos.append("con el `goal` del salón el cartel no dice los listones: «%s»" % cartel)
	elif not con_listones and dice_los_listones:
		fallos.append("sin el `goal` del salón el cartel dice listones: «%s»" % cartel)
	print("PARTIDA-AUTO reto %s: «%s»" % ["con listones" if con_listones else "sin listones", cartel])
	if game.modo_de_la_partida() != "challenge":
		fallos.append("con la semilla del salón se juega %s y no el reto" % game.modo_de_la_partida())
	if not game.en_reto():
		fallos.append("con la semilla del salón la partida no es el reto")
	if game.fase() == "menu":
		fallos.append("con el reto del salón se entra a jugar, no al menú")


func empezar_el_duelo() -> void:
	game.queue_free()
	# Sin salón: el duelo no es un reto, y con la semilla del salón se entraría en el reto. Fuera
	# del árbol ya, no al final del fotograma: la escena nueva lo buscaría antes.
	salon.get_parent().remove_child(salon)
	salon.queue_free()
	salon = null
	fase = "duelo"
	montar(true)


func comprobar_el_duelo(r: Dictionary) -> void:
	var duelo = r.duel
	if duelo == null:
		fallos.append("el duelo no se ha jugado como duelo: %s" % r.mode)
		return
	var partidas: Array = duelo.partidas
	if partidas.size() != 2:
		fallos.append("el duelo tiene %d partidas y no dos" % partidas.size())
		return
	if not duelo.over or duelo.next != null:
		fallos.append("el duelo no ha acabado: %s" % [duelo])
	# Las dos contra la misma máquina: la misma semilla y a los goles del duelo.
	if int(partidas[0].seed) != int(partidas[1].seed):
		fallos.append("la máquina juega con otra semilla a cada uno: %s y %s" % [partidas[0].seed, partidas[1].seed])
	for i in 2:
		var p: Dictionary = partidas[i]
		if maxi(int(p.scored), int(p.conceded)) != GOLES_DEL_DUELO:
			fallos.append("la partida %d acaba %d–%d y el duelo es a %d" % [i + 1, p.scored, p.conceded, GOLES_DEL_DUELO])
		var apuntada: Dictionary = duelo.matches[i]
		if int(apuntada.scored) != int(p.scored) or int(apuntada.conceded) != int(p.conceded):
			fallos.append("la partida %d se apunta %s y acabó %s" % [i + 1, apuntada, p])
	# El mismo jugador automático contra la misma máquina saca lo mismo: es lo que la semilla
	# compartida promete (dentro de una plataforma; ver «Lo que se sabe» en el README).
	if int(partidas[0].scored) != int(partidas[1].scored) or int(partidas[0].conceded) != int(partidas[1].conceded):
		fallos.append("el mismo jugador contra la misma máquina acaba %s y %s" % [partidas[0], partidas[1]])
	# Gana quien le saca más ventaja a la máquina; con la misma, empate.
	var ventaja := func(p: Dictionary) -> int: return int(p.scored) - int(p.conceded)
	var diferencia: int = ventaja.call(partidas[0]) - ventaja.call(partidas[1])
	var ganador = null if diferencia == 0 else (0 if diferencia > 0 else 1)
	if duelo.winner != ganador:
		fallos.append("gana %s con ventajas %d y %d" % [duelo.winner, ventaja.call(partidas[0]), ventaja.call(partidas[1])])
	var pareja: Dictionary = duelo.pareja
	var esperada := [0, 0]
	var empates := 0
	if ganador == null:
		empates = 1
	else:
		esperada[ganador] = 1
	if int(pareja.wins[0]) != esperada[0] or int(pareja.wins[1]) != esperada[1] or int(pareja.ties) != empates:
		fallos.append("el marcador de la pareja queda %s" % [pareja])
	# Ni récord ni aviso al salón: los goles son de dos personas.
	if r.record or int(r.best) != 0 or not r.resultados.is_empty():
		fallos.append("el duelo deja récord (%s, %s) o avisa al salón: %s" % [r.record, r.best, r.resultados])
	# Dos finales: el del primero suena a cómo le fue, el del duelo a ganar.
	var cierres: Array = r.cierres
	var primero := "win" if int(partidas[0].scored) > int(partidas[0].conceded) else "loss"
	if cierres != [primero, "win"]:
		fallos.append("los cierres del duelo son %s y no [%s, win]" % [cierres, primero])
	print("PARTIDA-AUTO duelo %d–%d y %d–%d, gana %s, semilla %d" % [
		partidas[0].scored, partidas[0].conceded, partidas[1].scored, partidas[1].conceded, duelo.winner, partidas[0].seed,
	])


func terminar() -> void:
	set_process(false)
	if salon != null:
		salon.queue_free()
	print("PARTIDA-AUTO %s %s" % ["ok" if fallos.is_empty() else "FAIL", ", ".join(fallos)])
	get_tree().quit(0 if fallos.is_empty() else 1)

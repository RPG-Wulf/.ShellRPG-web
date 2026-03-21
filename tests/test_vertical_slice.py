
from shellrpg_server.core.engine import GameEngine

def test_walk_route_cube_and_enter_dialogue():
    engine = GameEngine.create_demo()
    result = engine.execute("walk route cube")
    assert result.ok is True
    assert result.status.location_label == "Schwarzer Kubus"
    dialog = engine.execute("cube enter")
    assert dialog.status.dialogue_mode is True

def test_cube_ultimate_question_returns_42():
    engine = GameEngine.create_demo()
    engine.execute("walk route cube")
    engine.execute("cube enter")
    result = engine.execute("die endgültige Frage nach dem Leben, dem Universum und dem ganzen Rest?")
    assert result.message.strip() == "42"

def test_crafting_and_socketing_work():
    engine = GameEngine.create_demo()
    craft = engine.execute("craft --item sword --material iron")
    assert craft.ok is True
    engine.execute("equip iron sword")
    socket = engine.execute("socket --slot weapon --gem ruby shard")
    assert socket.ok is True
    assert engine.player.weapon_affixes

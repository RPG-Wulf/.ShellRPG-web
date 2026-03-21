
from shellrpg_server.core.engine import GameEngine

def test_cube_answers_42():
    eng = GameEngine.create_demo()
    eng.execute("walk route cube")
    eng.execute("cube enter")
    result = eng.execute("die endgültige Frage nach dem Leben, dem Universum und dem ganzen Rest?")
    assert result.message == "42"

def test_city_founding_and_militia():
    eng = GameEngine.create_demo()
    eng.execute("city found Morgenwacht")
    eng.execute("city build trade hall")
    eng.execute("militia recruit swordfighters 2")
    snapshot = eng.state_snapshot().to_dict()
    assert snapshot["city"]["city_name"] == "Morgenwacht"
    assert any("Schwertkämpfer" in line or "Sword Fighters" in line for line in snapshot["city"]["militia_lines"])

def test_craft_socket_enchant_pipeline():
    eng = GameEngine.create_demo()
    eng.execute("craft --item sword --material iron")
    eng.execute("equip iron sword")
    eng.execute("socket --slot weapon --gem ruby shard")
    eng.execute("enchant --slot weapon")
    assert eng.player.equipment.weapon == "iron_sword"
    assert eng.player.weapon_affixes

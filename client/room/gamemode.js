import { Players, Inventory, Teams, Game, Map, Build, Properties, LeaderBoard, Spawns, Timers, TeamsBalancer } from 'pixel_combats/room';
import { DisplayValueHeader } from 'pixel_combats/basic';
import * as teams from './default_teams.js';

// настройки
const MaxScores = 6;
const WaitingModeSeconds = 10;
const BuildModeSeconds = 30;
const GameModeSeconds = 120;
const EndGameSeconds = 5;
const EndOfMatchTime = 10;

// имена используемых обьектов 
const WaitingStateValue = "Waiting";
const BuildModeStateValue = "BuildMode";
const GameStateValue = "Game";
const EndOfGameStateValue = "EndOfGame";
const EndOfMatchStateValue = "EndOfMatch";
const scoresProp = "Scores";

// получаем обьекты, с которыми работает режим
const mainTimer = Timers.GetContext().Get("Main");
const stateProp = Properties.GetContext().Get("State");
const winTeamIdProp = Properties.GetContext().Get("WinTeam");

// применяем параметры конструктора режима
Damage.GetContext().FriendlyFire.Value = GameMode.Parameters.GetBool("FriendlyFire");
Map.Rotation = GameMode.Parameters.GetBool("MapRotation");
BreackGraph.OnlyPlayerBlocksDmg = GameMode.Parameters.GetBool("PartialDesruction");
BreackGraph.WeakBlocks = GameMode.Parameters.GetBool("LoosenBlocks");

// бустим блок игрока
BreackGraph.PlayerBlockBoost = true;

// выключаем контекст урона по гранате
Damage.GetContext().GranadeTouchExplosion.Value = false;

// имя игрового режима (устарело)
Properties.GetContext().GameModeName.Value = "GameModes/Team Dead Match";
TeamsBalancer.IsAutoBalance = true; // настраиваем баланс команд
Ui.GetContext().MainTimerId.Value = mainTimer.Id;
// создаем стандартные команды
const blueTeam = teams.create_blue_team();
const redTeam = teams.create_red_team();

// настраиваем параметры, которые нужно выводить в лидерборде
LeaderBoard.PlayerLeaderBoardValues = [
	new DisplayValueHeader("Kills", "Statistics/Kills", "Statistics/KillsShort"),
	new DisplayValueHeader("Deaths", "Statistics/Deaths", "Statistics/DeathsShort"),
	new DisplayValueHeader("Scores", "Statistics/Scores", "Statistics/ScoresShort")
];
LeaderBoard.TeamLeaderBoardValue = new DisplayValueHeader(scoresProp, "Statistics\\Scores", "Statistics\\Scores");
// задаем сортировку команд, для списка лидирующих по командному свойству
LeaderBoard.TeamWeightGetter.Set(function(team) {
const prop = team.Properties.Get(scoresProp);
if (prop.Value == null) return 0;
	return prop.Value;
});
// задаем сортировку игроков для списка лидирующих
LeaderBoard.PlayersWeightGetter.Set(function(player) {
const prop = player.Properties.Get("Scores");
if (prop.Value == null) return 0;
	return prop.Value;
});

// отображаем значения вверху экрана
Ui.GetContext().TeamProp1.Value = { Team: "Blue", Prop: scoresProp };
Ui.GetContext().TeamProp2.Value = { Team: "Red", Prop: scoresProp };

// отображаем изначально нули в очках команд
redTeam.Properties.Get(scoresProp).Value = 0;
blueTeam.Properties.Get(scoresProp).Value = 0;

// при запросе смены команды игрока - добавляем его в запрашиваемую команду
Teams.OnRequestJoinTeam.Add(function(player,team){team.Add(player);});
// при запросе спавна игрока - спавним его
Teams.OnPlayerChangeTeam.Add(function(player) {
	//if (stateProp.value === GameStateValue) 
	//	return;
	player.Spawns.Spawn();
});

// обработчик смертей
Damage.OnDeath.Add(function(player) {
	++player.Properties.Deaths.Value;
});
// обработчик убийств
Damage.OnKill.Add(function(player, killed) {
	if (killed.Team != null && killed.Team != player.Team) {
		++player.Properties.Kills.Value;
		player.Properties.Scores.Value += 100;
	}
});

//  ������ ������
function GetWinTeam(){
	winTeam = null;
	wins = 0;
	noAlife = true;
	for (const Team of Teams) {
		if (Team.GetAlivePlayersCount() > 0) {
			++wins;
			winTeam = Team;
		}
	}
	if (wins === 1) return winTeam;
	else return null;
}
function TrySwitchGameState() // ������� ������������ �� ����������
{
	if (stateProp.value !== GameStateValue) 
		return;

	// ������ ������
	winTeam = null;
	wins = 0;
	alifeCount = 0;
	hasEmptyTeam = false;
	for (const Team of Teams) {
		var alife = Team.GetAlivePlayersCount();
		alifeCount += alife;
		if (alife > 0) {
			++wins;
			winTeam = Team;
		}
		if (Team.Count == 0) hasEmptyTeam = true;
	}

	// ���� ���������� �������
	if (!hasEmptyTeam && alifeCount > 0 && wins === 1) {
		log.debug("hasEmptyTeam=" + hasEmptyTeam);
		log.debug("alifeCount=" + alifeCount);
		log.debug("wins=" + wins);
		winTeamIdProp.Value = winTeam.Id;
		StartEndOfGame(winTeam);
		return;
	}

	// ���������� ��� � ����� �� �������� - �����
	if (alifeCount == 0) {
		log.debug("���������� ��� � ����� �� �������� - �����");
		winTeamIdProp.Value = null;
		StartEndOfGame(null);
	}

	// ���������� ��� � �������� ������ �������� - �����
	if (!mainTimer.IsStarted) {
		log.debug("���������� ��� � ������ �� ������� - �����");
		winTeamIdProp.Value = null;
		StartEndOfGame(null);
	}
}
function OnGameStateTimer() // �������� �������� �����
{
	TrySwitchGameState();
}
Damage.OnDeath.Add(TrySwitchGameState);
Players.OnPlayerDisconnected.Add(TrySwitchGameState);

// ��������� ������������ �������
mainTimer.OnTimer.Add(function() {
	switch (stateProp.value) {
	case WaitingStateValue:
		SetBuildMode();
		break;
	case BuildModeStateValue:
		SetGameMode();
		break;
	case GameStateValue:
		OnGameStateTimer();
		break;
	case EndOfGameStateValue:
		EndEndOfGame();
		break;
	case EndOfMatchStateValue:
		RestartGame();
		break;
	}
});

// ������ ������ ������� ���������
SetWaitingMode();

// ��������� ����
function SetWaitingMode() { // ��������� �������� ������ �������
	stateProp.value = WaitingStateValue;
	Ui.GetContext().Hint.Value = "Hint/WaitingPlayers";
	Spawns.GetContext().enable = false;
	TeamsBalancer.IsAutoBalance = true;
	mainTimer.Restart(WaitingModeSeconts);
}

function SetBuildMode() 
{
	stateProp.value = BuildModeStateValue;
	Ui.GetContext().Hint.Value = "Hint/BuildBase";

	var inventory = Inventory.GetContext();
	inventory.Main.Value = false;
	inventory.Secondary.Value = false;
	inventory.Melee.Value = true;
	inventory.Explosive.Value = false;
	inventory.Build.Value = true;

	mainTimer.Restart(BuildModeSeconds);
	Spawns.GetContext().enable = true;
	TeamsBalancer.IsAutoBalance = true; // ��� ���������� �� ������ �����
	SpawnTeams();
}
function SetGameMode() 
{
	stateProp.value = GameStateValue;
	Ui.GetContext().Hint.Value = "Hint/AttackEnemies";
	winTeamIdProp.Value = null; // ����� �� �������

	var inventory = Inventory.GetContext();
	if (GameMode.Parameters.GetBool("OnlyKnives")) {
		inventory.Main.Value = false;
		inventory.Secondary.Value = false;
		inventory.Melee.Value = true;
		inventory.Explosive.Value = false;
		inventory.Build.Value = true;
	} else {
		inventory.Main.Value = true;
		inventory.Secondary.Value = true;
		inventory.Melee.Value = true;
		inventory.Explosive.Value = true;
		inventory.Build.Value = true;
	}

	mainTimer.Restart(GameModeSeconds);
	Spawns.GetContext().Despawn();
	Spawns.GetContext().RespawnEnable = false;
	TeamsBalancer.IsAutoBalance = false;
	TeamsBalancer.BalanceTeams();
	SpawnTeams();
}

function StartEndOfGame(team) { // team=null �� �����
	log.debug("win team="+team);
	stateProp.value = EndOfGameStateValue;
	if (team !== null) {
		log.debug(1);
		Ui.GetContext().Hint.Value = team + " wins!";
		 var prop = team.Properties.Get(scoresProp);
		 if (prop.Value == null) prop.Value = 1;
		 else prop.Value = prop.Value + 1;
	}
	else Ui.GetContext().Hint.Value = "Hint/Draw";

	mainTimer.Restart(EndGameSeconds);
}
function EndEndOfGame(){// ����� ����� �����
	if (winTeamIdProp.Value !== null) {
		var team = Teams.Get(winTeamIdProp.Value);
		var prop = team.Properties.Get(scoresProp);
		if (prop.Value >= MaxScores) SetEndOfMatchMode();
		else SetGameMode();
	}
	else SetGameMode();
}

function SetEndOfMatchMode() {
	stateProp.value = EndOfMatchStateValue;
	Ui.GetContext().Hint.Value = "Hint/EndOfMatch";

	var context = Spawns.GetContext();
	context.enable = false;
	context.Despawn();
	Game.GameOver(LeaderBoard.GetTeams());
	mainTimer.Restart(EndOfMatchTime);
}
function RestartGame() {
	Game.RestartGame();
}

function SpawnTeams() {
	for (const team of Teams) {
	Spawns.GetContext(team).Spawn();
	}
}

import { Timers, Properties, Teams, Damage, GameMode, Game, BreackGraph, Map, TeamsBalancer, Ui, LeaderBoard, Spawns, Inventory } from 'pixel_combats/room';
import { DisplayValueHeader, Color } from 'pixel_combats/basic';
import * as teams from './default_teams.js';

// ���������
const WaitingModeSeconts = 10;
const BuildModeSeconds = 30;
const GameModeSeconds = 120;
const EndGameSeconds = 5;
const EndOfMatchTime = 10;

const max_scores = 6;

// ��������� ����
const WaitingStateValue = "Waiting";
const BuildModeStateValue = "BuildMode";
const GameStateValue = "Game";
const EndOfGameStateValue = "EndOfGame";
const EndOfMatchStateValue = "EndOfMatch";

const scores_prop_name = "Scores";

// ���������� ����������
var mainTimer = Timers.GetContext().Get("Main");
var stateProp = Properties.GetContext().Get("State");
var winTeamIdProp = Properties.GetContext().Get("WinTeam");

// ��������� ��������� �������� �������
Damage.GetContext().FriendlyFire.Value = GameMode.Parameters.GetBool("FriendlyFire");
Map.Rotation = GameMode.Parameters.GetBool("MapRotation");
BreackGraph.OnlyPlayerBlocksDmg = GameMode.Parameters.GetBool("PartialDesruction");
BreackGraph.WeakBlocks = GameMode.Parameters.GetBool("LoosenBlocks");

// ���� ������ ������ ������
BreackGraph.PlayerBlockBoost = true;

// ��������� ���� ������� ��� �������
Damage.GetContext().GranadeTouchExplosion.Value = false;

// ��������� ����
Properties.GetContext().GameModeName.Value = "GameModes/Team Dead Match";
TeamsBalancer.IsAutoBalance = true; // ��� ���������� �� ������ �����
Ui.GetContext().MainTimerId.Value = mainTimer.Id;
// ������� �������
const blueTeam = teams.create_team_blue();
const redTeam = teams.create_team_red();
redTeam.Build.BlocksSet.Value = BuildBlocksSet.Red;
blueTeam.Build.BlocksSet.Value = BuildBlocksSet.Blue;

// ������ ��� �������� � �����������
LeaderBoard.PlayerLeaderBoardValues = [
	{
		Value: "Kills",
		DisplayName: "Statistics/Kills",
		ShortDisplayName: "Statistics/KillsShort"
	},
	{
		Value: "Deaths",
		DisplayName: "Statistics/Deaths",
		ShortDisplayName: "Statistics/\DeathsShort"
	},
	{
		Value: scores_prop_name,
		DisplayName: "Statistics/Scores",
		ShortDisplayName: "Statistics/ScoresShort"
	}
];
LeaderBoard.TeamLeaderBoardValue = {
	Value: scores_prop_name,
	DisplayName: "Statistics\Scores",
	ShortDisplayName: "Statistics\ScoresShort"
};
// ��� ������� � ����������
LeaderBoard.TeamWeightGetter.Set(function(team) {
 const prop = team.Properties.Get(scores_prop_name);
if (prop.Value == null) return 0;
   return prop.Value;
});
// ��� ������ � ����������
LeaderBoard.PlayersWeightGetter.Set(function(player) {
 const prop = player.Properties.Get(scores_prop_name);
if (prop.Value == null) return 0;
    return prop.Value;
});

// ������ ��� �������� ������
Ui.GetContext().TeamProp1.Value = { Team: "Blue", Prop: scores_prop_name };
Ui.GetContext().TeamProp2.Value = { Team: "Red", Prop: scores_prop_name };

// ������� 0 ������
for (const team of Teams.All) {
      team.Properties.Get(scores_prop_name).Value = 0;
}

// ��������� ���� � ������� �� �������
Teams.OnRequestJoinTeam.Add(function(player,team){team.Add(player);});
// ����� �� ����� � �������
Teams.OnPlayerChangeTeam.Add(function(player) {
	//if (stateProp.value === GameStateValue) 
	//	return;
	player.Spawns.Spawn();
});

// ������� �������
Damage.OnDeath.Add(function(player) {
	++player.Properties.Deaths.Value;
});
// ������� �������
Damage.OnKill.Add(function(player, killed) {
	if (killed.Team != null && killed.Team != player.Team) {
		++player.Properties.Kills.Value;
		player.Properties.Scores.Value += 100;
	}
});

// ��������� ������� �������
function GetWinTeam(){
	winTeam = null;
	wins = 0;
	noAlife = true;
	for (const team of Teams.All) {
	if (team.GetAlivePlayersCount() > 0) {
		++wins;
	winTeam = team;
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
	for (const team of Teams.All) {
		var alife = team.GetAlivePlayersCount();
		alifeCount += alife;
		if (alife > 0) {
			++wins;
			winTeam = team;
		}
		if (team.Count == 0) hasEmptyTeam = true;
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
		 var prop = team.Properties.Get(scores_prop_name);
		 if (prop.Value == null) prop.Value = 1;
		 else prop.Value = prop.Value + 1;
	}
	else Ui.GetContext().Hint.Value = "Hint/Draw";

	mainTimer.Restart(EndGameSeconds);
}
function EndEndOfGame(){// ����� ����� �����
	if (winTeamIdProp.Value !== null) {
		var team = Teams.Get(winTeamIdProp.Value);
		var prop = team.Properties.Get(scores_prop_name);
		if (prop.Value >= max_scores) SetEndOfMatchMode();
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
	for (const team of Teams.All) {
	Spawns.GetContext(team).Spawn();
	}
  }

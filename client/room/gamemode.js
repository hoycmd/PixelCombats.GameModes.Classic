import { Timers, Properties, Teams, Damage, GameMode, Game, BreackGraph, Map, TeamsBalancer, Ui, LeaderBoard, Spawns, Inventory } from 


// ���������
var MaxScores = 6;
var WaitingModeSeconts = 10;
var BuildModeSeconds = 30;
var GameModeSeconds = 120;
var EndGameSeconds = 5;
var EndOfMatchTime = 10;

// ��������� ����
var WaitingStateValue = "Waiting";
var BuildModeStateValue = "BuildMode";
var GameStateValue = "Game";
var EndOfGameStateValue = "EndOfGame";
var EndOfMatchStateValue = "EndOfMatch";
var scoresProp = "Scores";

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
Teams.Add("Blue", "Teams/Blue", { b: 1 });
Teams.Add("Red", "Teams/Red", { r: 1 });
Teams.Get("Blue").Spawns.SpawnPointsGroups.Add(1);
Teams.Get("Red").Spawns.SpawnPointsGroups.Add(2);
Teams.Get("Red").Build.BlocksSet.Value = BuildBlocksSet.Red;
Teams.Get("Blue").Build.BlocksSet.Value = BuildBlocksSet.Blue;

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
		Value: "Scores",
		DisplayName: "Statistics/Scores",
		ShortDisplayName: "Statistics/ScoresShort"
	}
];
LeaderBoard.TeamLeaderBoardValue = {
	Value: scoresProp,
	DisplayName: "Statistics\Scores",
	ShortDisplayName: "Statistics\ScoresShort"
};
// ��� ������� � ����������
LeaderBoard.TeamWeightGetter.Set(function(team) {
	var prop = team.Properties.Get(scoresProp);
	if (prop.Value == null) return 0;
	return prop.Value;
});
// ��� ������ � ����������
LeaderBoard.PlayersWeightGetter.Set(function(player) {
	var prop = player.Properties.Get("Scores");
	if (prop.Value == null) return 0;
	return prop.Value;
});

// ������ ��� �������� ������
Ui.GetContext().TeamProp1.Value = { Team: "Blue", Prop: scoresProp };
Ui.GetContext().TeamProp2.Value = { Team: "Red", Prop: scoresProp };

// ������� 0 ������
for (e = Teams.GetEnumerator(); e.MoveNext();) {
	e.Current.Properties.Get(scoresProp).Value= 0;
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
	for (e = Teams.GetEnumerator(); e.MoveNext();) {
		if (e.Current.GetAlivePlayersCount() > 0) {
			++wins;
			winTeam = e.Current;
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
	for (e = Teams.GetEnumerator(); e.MoveNext();) {
		var alife = e.Current.GetAlivePlayersCount();
		alifeCount += alife;
		if (alife > 0) {
			++wins;
			winTeam = e.Current;
		}
		if (e.Current.Count == 0) hasEmptyTeam = true;
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
	var e = Teams.GetEnumerator();
	while (e.moveNext()) {
		Spawns.GetContext(e.Current).Spawn();
	}
  }

var Cell = (function () {
    function Cell(row, col) {
        this.maxValue = 255;
        this.Row = row;
        this.Col = col;
        this.Owner = 0;
        this.Value = 0;
    }
    Cell.prototype.Clone = function () {
        var result = new Cell(this.Row, this.Col);
        result.Value = this.Value;
        result.Owner = this.Owner;
        return result;
    };
    Cell.prototype.UpgradeValue = function () {
        //dit kan slimmer! je bent gewoon lui he?. even bitjes tellen man. 
        if (this.Value >= 128) {
            this.Value += 8;
            if (this.Value > this.maxValue) {
                this.Value = this.maxValue;
            }
            return;
        }
        if (this.Value >= 64) {
            this.Value += 7;
            return;
        }
        if (this.Value >= 32) {
            this.Value += 6;
            return;
        }
        if (this.Value >= 16) {
            this.Value += 5;
            return;
        }
        if (this.Value >= 8) {
            this.Value += 4;
            return;
        }
        if (this.Value >= 4) {
            this.Value += 3;
            return;
        }
        if (this.Value >= 2) {
            this.Value += 2;
            return;
        }
        if (this.Value >= 1) {
            this.Value += 1;
            return;
        }
    };
    Cell.prototype.AddValue = function (value, playerID) {
        if ((this.Owner == 0) || (this.Owner == playerID)) {
            this.Value += value;
            if (this.Value > this.maxValue) {
                this.Value = this.maxValue;
            }
            this.Owner = playerID;
        }
        else {
            this.Value -= value;
            if (this.Value == 0) {
                this.Owner = 0;
            }
            if (this.Value < 0) {
                this.Value *= -1;
                this.Owner = playerID;
            }
        }
    };
    return Cell;
}());
/// <reference path="Cell.ts" />
var GameState = (function () {
    function GameState(dim) {
        this.dimension = 8;
        this.round = 0;
        this.winner = 0;
        this.dimension = dim;
        this.cells = new Array(dim * dim);
        var counter = 0;
        for (var y = 0; y < this.dimension; y++) {
            for (var x = 0; x < this.dimension; x++) {
                this.cells[counter] = new Cell(y, x);
                counter++;
            }
        }
    }
    GameState.prototype.GetIndexFromPos = function (row, col) {
        return row * this.dimension + col;
    };
    GameState.prototype.GetCell = function (row, col) {
        return this.cells[this.GetIndexFromPos(row, col)];
    };
    GameState.prototype.GetCellByIndex = function (index) {
        return this.cells[index];
    };
    GameState.prototype.CellsOfThread = function (ThreadID) {
        return this.cells.filter(function (c) { return c.Owner == ThreadID; });
    };
    GameState.prototype.GetCells = function () {
        return this.cells;
    };
    GameState.prototype.GetCellsAround = function (row, col) {
        var result = [];
        //NW, W, SW
        if (col > 0) {
            result.push(this.cells[this.GetIndexFromPos(row, col - 1)]);
            if (row > 0) {
                result.push(this.cells[this.GetIndexFromPos(row - 1, col - 1)]);
            }
            if (row < this.dimension - 1) {
                result.push(this.cells[this.GetIndexFromPos(row + 1, col - 1)]);
            }
        }
        //N , S
        if (row > 0) {
            result.push(this.cells[this.GetIndexFromPos(row - 1, col)]);
        }
        if (row < this.dimension - 1) {
            result.push(this.cells[this.GetIndexFromPos(row + 1, col)]);
        }
        //NE , E , SE
        if (col < this.dimension - 1) {
            result.push(this.cells[this.GetIndexFromPos(row, col + 1)]);
            if (row > 0) {
                result.push(this.cells[this.GetIndexFromPos(row - 1, col + 1)]);
            }
            if (row < this.dimension - 1) {
                result.push(this.cells[this.GetIndexFromPos(row + 1, col + 1)]);
            }
        }
        return result;
    };
    GameState.prototype.Clone = function () {
        var result = new GameState(this.dimension);
        result.winner = this.winner;
        result.round = this.round;
        for (var i = 0; i < this.cells.length; i++) {
            result.cells[i] = this.cells[i].Clone();
        }
        return result;
    };
    //stats helper functions
    GameState.prototype.CellsOccupied = function (ThreadID) {
        return this.CellsOfThread(ThreadID).length;
    };
    GameState.prototype.CellsThread1 = function () { return this.CellsOccupied(1); };
    GameState.prototype.CellsThread2 = function () { return this.CellsOccupied(2); };
    GameState.prototype.CellsValue = function (ThreadID) {
        var sum = 0;
        this.CellsOfThread(ThreadID).forEach(function (c) { return sum += c.Value; });
        return sum;
    };
    GameState.prototype.CellsValue1 = function () { return this.CellsValue(1); };
    GameState.prototype.CellsValue2 = function () { return this.CellsValue(2); };
    return GameState;
}());
var ThreadAction = (function () {
    function ThreadAction(threadID, sourceIndex, destIndex, count) {
        this.threadID = threadID;
        this.sourceIndex = sourceIndex;
        this.destIndex = destIndex;
        this.count = count;
    }
    return ThreadAction;
}());
/// <reference path="ThreadAction" />
/// <reference path="GameState" />
/// <reference path="GameState" />
/// <reference path="ThreadAction" />
/// <reference path="IThreadEngine" />
/// <reference path="Cell" />
var Simulator = (function () {
    function Simulator(player1, player2) {
        this.maxRounds = 2000;
        this.dimension = 8;
        this.statehistory = [];
        this.actionhistory = [];
        this.state = new GameState(this.dimension);
        this.player1 = player1;
        this.player2 = player2;
        //initialize positions of players.
        this.state.GetCell(0, 0).Owner = 1;
        this.state.GetCell(0, 0).Value = 1;
        this.state.GetCell(this.dimension - 1, this.dimension - 1).Owner = 2;
        this.state.GetCell(this.dimension - 1, this.dimension - 1).Value = 1;
    }
    Simulator.prototype.PlayGame = function () {
        while (this.state.winner == 0) {
            this.DoRound();
        }
    };
    Simulator.prototype.DoRound = function () {
        var _this = this;
        var actions = [];
        //TODO forge prevention?
        this.player1.GetActions(this.state).forEach(function (a) { return actions.push(a); });
        this.player2.GetActions(this.state).forEach(function (a) { return actions.push(a); });
        //LOG state & action
        this.statehistory.push(this.state.Clone());
        this.actionhistory.push(actions);
        //make sure all actions are valid
        actions.forEach(function (action) {
            if (!_this.ValidateAction(action)) {
                _this.state.winner = (action.threadID == 1 ? 2 : 1);
            }
        });
        // zat er een illegale move tussen? 
        if (this.state.winner != 0) {
            return false;
        }
        // moves uitvoeren , hou een lijst bij met Cell 
        // 
        var touchedCells = [];
        var c;
        //
        actions.forEach(function (action) {
            c = _this.state.GetCellByIndex(action.sourceIndex);
            c.Value -= action.count;
            touchedCells.push(c);
        });
        actions.forEach(function (action) {
            c = _this.state.GetCellByIndex(action.destIndex);
            if (c == null) {
                console.log(action);
            }
            ;
            c.AddValue(action.count, action.threadID);
            touchedCells.push(c);
        });
        // upgrade untouched cells voltage;
        this.state.GetCells().forEach(function (cell) {
            if (touchedCells.indexOf(cell) == -1) {
                cell.UpgradeValue();
            }
        });
        // ronde is klaar! iemand verslagen?
        var cells1 = this.state.CellsThread1();
        var cells2 = this.state.CellsThread2();
        if (cells1 == 0) {
            this.state.winner = 2;
        }
        if (cells2 == 0) {
            this.state.winner = 1;
        }
        this.state.round++;
        if (this.state.round >= this.maxRounds) {
            //force a winner..
            if (this.state.winner == 0) {
                //step 1 ; look at max Cells
                if (cells1 == cells2) {
                    //step 2 ; look at max Value
                    var val1 = this.state.CellsValue1();
                    var val2 = this.state.CellsValue2();
                    if (val1 == val2) {
                        this.state.winner = 1;
                    }
                    else {
                        this.state.winner = val1 > val2 ? 1 : 2;
                    }
                }
                else {
                    this.state.winner = cells1 > cells2 ? 1 : 2;
                }
            }
        }
        return (this.state.winner == 0);
    };
    Simulator.prototype.ValidateAction = function (action) {
        var isValid = true;
        //  is bronplek van playerid
        if (this.state.GetCellByIndex(action.sourceIndex).Owner != action.threadID) {
            isValid = false;
        }
        //  is voldoende aanwezig?
        if (this.state.GetCellByIndex(action.sourceIndex).Value < action.count) {
            isValid = false;
        }
        //  is bestemming in straal van 1 vakje
        //if (Math.Abs(action.fromCol - action.toCol) > 1) { isValid = false; }
        //if (Math.Abs(action.fromRow - action.toRow) > 1) { isValid = false; }
        return isValid;
    };
    return Simulator;
}());
/// <reference path="Simulator" />
var Runner = (function () {
    function Runner(element) {
        this.activeState = null;
        this.activeActions = null;
        this.activeAction = null;
        this.element = element;
        this.element.innerHTML = "<h5>Memory chip</h5>";
        this.sim = new Simulator(new SampleEngine(1), new SampleEngine(2));
        //built initial output
        var te = document.createElement("table");
        te.className = "simulator";
        for (var row = 0; row < this.sim.dimension; row++) {
            var tr = te.insertRow();
            for (var col = 0; col < this.sim.dimension; col++) {
                var tc = tr.insertCell();
                tc.id = "r" + row.toString() + "c" + col.toString();
            }
        }
        this.element.appendChild(te);
    }
    Runner.prototype.setStep = function (step) {
        this.activeAction = null;
        this.curStep = parseInt(step);
        this.activeState = this.sim.statehistory[step];
        this.activeActions = this.sim.actionhistory[step];
        this.output();
    };
    Runner.prototype.incStep = function () {
        if (this.curStep < this.sim.state.round) {
            this.setStep(this.curStep + 1);
        }
    };
    Runner.prototype.decStep = function () {
        var step = this.curStep - 1;
        if (step < 0) {
            step = 0;
        }
        this.setStep(step);
    };
    Runner.prototype.lastStep = function () {
        var step = this.sim.state.round - 1;
        this.setStep(step);
    };
    Runner.prototype.output = function () {
        if (this.activeState != null) {
            this.activeState.GetCells().forEach(function (c) {
                var tc = document.getElementById("r" + c.Row + "c" + c.Col);
                tc.innerText = c.Value.toString();
                tc.className = "";
                if (c.Owner == 1) {
                    tc.className = "td1";
                }
                if (c.Owner == 2) {
                    tc.className = "td2";
                }
            });
        }
        //update actions
        var act1 = document.getElementById("actions1");
        var act2 = document.getElementById("actions2");
        act1.innerHTML = "";
        act2.innerHTML = "";
        if (this.activeActions != null) {
            this.activeActions.forEach(function (action) {
                var x = document.createElement("option");
                x.value = JSON.stringify(action);
                x.text = action.sourceIndex + " -> " + action.destIndex + " = " + action.count;
                if (action.threadID == 1) {
                    act1.add(x);
                }
                else {
                    act2.add(x);
                }
            });
        }
        act1.size = act1.children.length + 1;
        act2.size = act2.children.length + 1;
        act1.value = null;
        act2.value = null;
        //update debug info
        var dbg = document.getElementById("debuginfo");
        if (dbg != null) {
            dbg.innerText = this.curStep.toString() + " of " + this.sim.state.round.toString();
        }
        //
        if (this.activeAction != null) {
            //source 
            var row = Math.floor(this.activeAction.sourceIndex / this.sim.dimension);
            var col = this.activeAction.sourceIndex - row * this.sim.dimension;
            var tc = document.getElementById("r" + row + "c" + col);
            tc.className += " tdselect";
            //tc.innerText += "->";
            //dest
            var row = Math.floor(this.activeAction.destIndex / this.sim.dimension);
            var col = this.activeAction.destIndex - row * this.sim.dimension;
            var tc = document.getElementById("r" + row + "c" + col);
            tc.className += " tdselect";
        }
    };
    Runner.prototype.start = function () {
        var _this = this;
        //
        clearTimeout(this.timerToken);
        var e1 = this.getEngineByName(this.getSelectedEngineName(1), 1);
        var e2 = this.getEngineByName(this.getSelectedEngineName(2), 2);
        this.sim = new Simulator(e1, e2);
        //var e = <HTMLInputElement>document.getElementById("currentRound");
        //e.value = "0";
        //e.max = "0";
        this.activeState = null;
        this.activeActions = null;
        this.activeAction = null;
        this.curStep = 0;
        this.timerToken = setInterval(function () {
            _this.sim.DoRound();
            _this.setStep(_this.sim.state.round - 1);
            //this.output();
            if (_this.sim.state.winner != 0) {
                _this.stop();
                //var el = document.getElementById('output');
                //var runner = new Runner(el);
                //runner.start();
                document.getElementById("slider").setAttribute("max", (_this.sim.state.round).toString());
            }
        }, 10);
    };
    Runner.prototype.showAction = function (id, value) {
        if (value != null) {
            var act1 = document.getElementById("actions" + id);
            if (act1 != null) {
                this.activeAction = JSON.parse(act1.value);
            }
            this.output();
        }
    };
    Runner.prototype.stop = function () {
        clearTimeout(this.timerToken);
        document.getElementById("slider").setAttribute("max", (this.sim.state.round).toString());
    };
    Runner.prototype.getSelectedEngineName = function (id) {
        var e = document.getElementById("engine" + id);
        return e.value;
    };
    Runner.prototype.getEngineByName = function (name, id) {
        if (name == "v1") {
            return new SimpleEngine(id);
        }
        if (name == "v2") {
            return new ProgrammedEngine1(id);
        }
        if (name == "v3") {
            return new ProgrammedEngine2(id);
        }
        if (name == "v4") {
            return new ProgrammedEngine3(id);
        }
        return null;
    };
    return Runner;
}());
/// <reference path="IThreadEngine" />
/// <reference path="ThreadAction" />
/// <reference path="GameState" />
/// <reference path="Cell" />
var ProgrammedEngine1 = (function () {
    function ProgrammedEngine1(ThreadID) {
        this.threadID = ThreadID;
    }
    ProgrammedEngine1.getDescription = function () {
        return "Per cell change of 1/value to get into action. Select destination strategy: 1.free 2.enemy 3.own cell. Random transfer value";
    };
    ProgrammedEngine1.prototype.GetActions = function (state) {
        var _this = this;
        //
        var result = [];
        //bekijken eigen cellen
        var myCells = state.CellsOfThread(this.threadID);
        myCells.forEach(function (mycell) {
            if (mycell.Value > 1) {
                //kans van 2 tot 255 
                if (Math.random() > (1.0 - (mycell.Value / 255.0))) {
                    //omliggende cellen opvragren en pick er eentje..
                    var surroundingCells = state.GetCellsAround(mycell.Row, mycell.Col);
                    var dest = surroundingCells[0];
                    for (var i = 1; i < surroundingCells.length; i++) {
                        if (surroundingCells[i].Value < dest.Value) {
                            dest = surroundingCells[i];
                        }
                    }
                    var total = state.CellsValue(_this.threadID);
                    var ocupied = state.CellsOccupied(_this.threadID);
                    //pick random cell.
                    var emptySourrce = surroundingCells.filter(function (c) { return c.Owner == 0; });
                    var otherPlayer = _this.threadID == 1 ? 2 : 1;
                    if (emptySourrce.length > 0) {
                        var ndx = Math.floor(Math.random() * emptySourrce.length);
                        dest = emptySourrce[ndx];
                    }
                    else {
                        var enemySource = surroundingCells.filter(function (c) { return c.Owner == otherPlayer; });
                        if (enemySource.length > 0) {
                            var ndx = Math.floor(Math.random() * enemySource.length);
                            dest = enemySource[ndx];
                        }
                        else {
                            var ndx = Math.floor(Math.random() * surroundingCells.length);
                            dest = surroundingCells[ndx];
                        }
                    }
                    //pick random value to transfer
                    var transferValue = Math.floor(Math.random() * (mycell.Value - 1)) + 1;
                    transferValue = Math.floor(mycell.Value * 0.9) - 1;
                    //leg de actie vast
                    var sourceIndex = mycell.Row * state.dimension + mycell.Col;
                    var destIndex = dest.Row * state.dimension + dest.Col;
                    result.push(new ThreadAction(_this.threadID, sourceIndex, destIndex, transferValue));
                }
            }
        });
        return result;
    };
    return ProgrammedEngine1;
}());
var ProgrammedEngine2 = (function () {
    function ProgrammedEngine2(ThreadID) {
        this.threadID = ThreadID;
    }
    ProgrammedEngine2.getDescription = function () {
        return "Per cell change of 1/value to get into action. Select destination strategy: 1.free 2.enemy 3.own cell. Random transfer value";
    };
    ProgrammedEngine2.prototype.GetActions = function (state) {
        var _this = this;
        //
        var result = [];
        //bekijken eigen cellen
        var myCells = state.CellsOfThread(this.threadID);
        var otherPlayer = this.threadID == 1 ? 2 : 1;
        myCells.forEach(function (mycell) {
            var skipthis = false;
            if (mycell.Value > 1) {
                //get all cells connected to current cell
                var surroundingCells = state.GetCellsAround(mycell.Row, mycell.Col);
                //by default pick the cell with the lowest value
                var dest = surroundingCells[0];
                surroundingCells.forEach(function (cell) {
                    if (cell.Value < dest.Value) {
                        dest = cell;
                    }
                });
                //total value of all owned cells
                var total = state.CellsValue(_this.threadID);
                //number of owned cells
                var ocupied = state.CellsOccupied(_this.threadID);
                //get the average value of the cells
                var average = ocupied != 0 ? total / ocupied : 0;
                //connecting cells not owned by either players
                var emptyCells = surroundingCells.filter(function (c) { return c.Owner == 0; });
                //connecting cells owned by enemy
                var enemyCells = surroundingCells.filter(function (c) { return c.Owner == otherPlayer; });
                //get the nearest enemy cell
                var nearestEnemy = HelperClass.nearestEnemy(state, mycell, _this.threadID);
                //get the distance to the nearest enemy cell
                var distanceToEnemy = HelperClass.cellDistance(mycell, nearestEnemy);
                //to enable growing only do something when a certain threshold is exceeded
                if (mycell.Value > 20) {
                    //if there are no empty or enemy cells connected
                    if (emptyCells.length == 0 && (enemyCells.length == 0)) {
                        //if the current cell is very far away from the battle send your points to the battlefield
                        if (distanceToEnemy > state.dimension / 3) {
                            dest = HelperClass.attackDirection(mycell, nearestEnemy, state);
                        }
                    }
                    else {
                        if (emptyCells.length > 0) {
                            var ndx = Math.floor(Math.random() * emptyCells.length);
                            dest = emptyCells[ndx];
                        }
                        else {
                            if (enemyCells.length > 0) {
                                dest = enemyCells[0];
                                enemyCells.forEach(function (cell) {
                                    dest = cell.Value < dest.Value ? cell : dest;
                                });
                            }
                            else {
                                //var ndx = Math.floor(Math.random() * surroundingCells.length);
                                //dest = surroundingCells[ndx];
                                surroundingCells.forEach(function (cell) {
                                    dest = cell.Value < dest.Value ? cell : dest;
                                });
                            }
                        }
                    }
                    //pick random value to transfer
                    var transferValue; // = Math.floor(Math.random() * (mycell.Value - 1)) + 1;
                    //transferValue = Math.floor(mycell.Value * 0.9) - 1;
                    //if the transfer is to another player thus attacking
                    if (dest.Owner == otherPlayer) {
                        var aggressiveness = 0.7;
                        if (mycell.Value > dest.Value / aggressiveness) {
                            transferValue = Math.floor(dest.Value + (mycell.Value - dest.Value) * aggressiveness);
                        }
                        else {
                            skipthis = true;
                        }
                    }
                    else if (dest.Owner == _this.threadID) {
                        if (distanceToEnemy > state.dimension / 3) {
                            transferValue = Math.min(Math.floor(mycell.Value * 0.8), 255 - dest.Value);
                            if (transferValue < HelperClass.gain(dest.Value)) {
                                skipthis = true;
                            }
                        }
                        else {
                            if (mycell.Value < 40) {
                                skipthis = true;
                            }
                            else {
                                transferValue = Math.floor(mycell.Value * 0.9) - 1;
                            }
                        }
                    }
                    else {
                        transferValue = Math.floor(mycell.Value * 0.9) - 1;
                    }
                    //leg de actie vast
                    if (skipthis == false) {
                        var sourceIndex = mycell.Row * state.dimension + mycell.Col;
                        var destIndex = dest.Row * state.dimension + dest.Col;
                        result.push(new ThreadAction(_this.threadID, sourceIndex, destIndex, transferValue));
                    }
                }
            }
        });
        return result;
    };
    return ProgrammedEngine2;
}());
var ProgrammedEngine3 = (function () {
    function ProgrammedEngine3(ThreadID) {
        this.threadID = ThreadID;
    }
    ProgrammedEngine3.getDescription = function () {
        return "Per cell change of 1/value to get into action. Select destination strategy: 1.free 2.enemy 3.own cell. Random transfer value";
    };
    ProgrammedEngine3.prototype.GetActions = function (state) {
        var _this = this;
        //
        var result = [];
        //bekijken eigen cellen
        var myCells = state.CellsOfThread(this.threadID);
        var otherPlayer = this.threadID == 1 ? 2 : 1;
        myCells.forEach(function (mycell) {
            var skipthis = false;
            if (mycell.Value > 1) {
                //get all cells connected to current cell
                var surroundingCells = state.GetCellsAround(mycell.Row, mycell.Col);
                //by default pick the cell with the lowest value
                var dest = surroundingCells[0];
                surroundingCells.forEach(function (cell) {
                    if (cell.Value < dest.Value) {
                        dest = cell;
                    }
                });
                //total value of all owned cells
                var total = state.CellsValue(_this.threadID);
                //number of owned cells
                var ocupied = state.CellsOccupied(_this.threadID);
                //get the average value of the cells
                var average = ocupied != 0 ? total / ocupied : 0;
                //connecting cells not owned by either players
                var emptyCells = surroundingCells.filter(function (c) { return c.Owner == 0; });
                //connecting cells owned by enemy
                var enemyCells = surroundingCells.filter(function (c) { return c.Owner == otherPlayer; });
                //get the nearest enemy cell
                var nearestEnemy = HelperClass.nearestEnemy(state, mycell, _this.threadID);
                //get the distance to the nearest enemy cell
                var distanceToEnemy = HelperClass.cellDistance(mycell, nearestEnemy);
                //to enable growing only do something when a certain threshold is exceeded
                if (mycell.Value > 20) {
                    //if there are no empty or enemy cells connected
                    if (emptyCells.length == 0 && (enemyCells.length == 0)) {
                        //if the current cell is very far away from the battle send your points to the battlefield
                        if (distanceToEnemy > state.dimension / 3) {
                            dest = HelperClass.attackDirection(mycell, nearestEnemy, state);
                        }
                    }
                    else {
                        if (emptyCells.length > 0) {
                            var ndx = Math.floor(Math.random() * emptyCells.length);
                            dest = emptyCells[ndx];
                        }
                        else {
                            if (enemyCells.length > 0) {
                                dest = enemyCells[0];
                                enemyCells.forEach(function (cell) {
                                    dest = cell.Value < dest.Value ? cell : dest;
                                });
                            }
                            else {
                                //var ndx = Math.floor(Math.random() * surroundingCells.length);
                                //dest = surroundingCells[ndx];
                                surroundingCells.forEach(function (cell) {
                                    dest = cell.Value < dest.Value ? cell : dest;
                                });
                            }
                        }
                    }
                    //pick random value to transfer
                    var transferValue; // = Math.floor(Math.random() * (mycell.Value - 1)) + 1;
                    //transferValue = Math.floor(mycell.Value * 0.9) - 1;
                    //if the transfer is to another player thus attacking
                    if (dest.Owner == otherPlayer) {
                        var aggressiveness = 0.7;
                        if (mycell.Value > dest.Value / aggressiveness) {
                            transferValue = Math.floor(dest.Value + (mycell.Value - dest.Value) * aggressiveness);
                        }
                        else {
                            skipthis = true;
                        }
                    }
                    else if (dest.Owner == _this.threadID) {
                        if (distanceToEnemy > state.dimension / 3) {
                            transferValue = Math.min(Math.floor(mycell.Value * 0.8), 255 - dest.Value);
                            if (transferValue < HelperClass.gain(dest.Value)) {
                                skipthis = true;
                            }
                        }
                        else {
                            if (mycell.Value < 40) {
                                skipthis = true;
                            }
                            else {
                                transferValue = Math.floor(mycell.Value * 0.9) - 1;
                            }
                        }
                    }
                    else {
                        transferValue = Math.floor(mycell.Value * 0.9) - 1;
                    }
                    //if there is already an action to the destination check if it is the 
                    result.forEach(function (action) {
                        if (state.GetIndexFromPos(dest.Row, dest.Col) == action.destIndex) {
                            //if (transferValue > action.count) {
                            //    result = result.filter(filt => filt != action);
                            //}
                            if (HelperClass.cellDistance(nearestEnemy, mycell) < HelperClass.cellDistance(nearestEnemy, state.GetCellByIndex(action.sourceIndex))) {
                                result = result.filter(function (filt) { return filt != action; });
                            }
                        }
                    });
                    //leg de actie vast
                    if (skipthis == false) {
                        var sourceIndex = mycell.Row * state.dimension + mycell.Col;
                        var destIndex = dest.Row * state.dimension + dest.Col;
                        result.push(new ThreadAction(_this.threadID, sourceIndex, destIndex, transferValue));
                    }
                }
            }
        });
        return result;
    };
    return ProgrammedEngine3;
}());
var HelperClass = (function () {
    function HelperClass() {
    }
    HelperClass.nearestEnemy = function (state, curCell, owner) {
        var _this = this;
        var allCells = state.GetCells();
        var distance = 100;
        var nearestCell = new Cell(curCell.Row, curCell.Col);
        var enemy = owner == 1 ? 2 : 1;
        allCells.forEach(function (cell) {
            if (cell.Owner == enemy) {
                var curDistance = _this.cellDistance(curCell, cell);
                if (curDistance < distance) {
                    distance = curDistance;
                    nearestCell = cell;
                }
            }
        });
        return nearestCell;
    };
    HelperClass.cellDistance = function (cellA, cellB) {
        var distance = Math.pow(cellA.Row - cellB.Row, 2) + Math.pow(cellA.Col - cellB.Col, 2);
        return Math.abs(Math.sqrt(distance));
    };
    HelperClass.attackDirection = function (cellA, cellB, state) {
        if (cellB.Col > cellA.Col) {
            if (cellB.Row < cellA.Row) {
                return state.GetCellByIndex(state.GetIndexFromPos(cellA.Row - 1, cellA.Col + 1));
            }
            else if (cellB.Row > cellA.Row) {
                return state.GetCellByIndex(state.GetIndexFromPos(cellA.Row + 1, cellA.Col + 1));
            }
            else {
                return state.GetCellByIndex(state.GetIndexFromPos(cellA.Row, cellA.Col + 1));
            }
        }
        else if (cellB.Col < cellA.Col) {
            if (cellB.Row < cellA.Row) {
                return state.GetCellByIndex(state.GetIndexFromPos(cellA.Row - 1, cellA.Col - 1));
            }
            else if (cellB.Row > cellA.Row) {
                return state.GetCellByIndex(state.GetIndexFromPos(cellA.Row + 1, cellA.Col - 1));
            }
            else {
                return state.GetCellByIndex(state.GetIndexFromPos(cellA.Row, cellA.Col - 1));
            }
        }
        else {
            if (cellB.Row < cellA.Row) {
                return state.GetCellByIndex(state.GetIndexFromPos(cellA.Row - 1, cellA.Col));
            }
            else if (cellB.Row > cellA.Row) {
                return state.GetCellByIndex(state.GetIndexFromPos(cellA.Row + 1, cellA.Col));
            }
        }
    };
    HelperClass.gain = function (points) {
        if (points >= 128) {
            return 8;
        }
        if (points >= 64) {
            return 7;
        }
        if (points >= 32) {
            return 6;
        }
        if (points >= 16) {
            return 5;
        }
        if (points >= 8) {
            return 4;
        }
        if (points >= 4) {
            return 3;
        }
        if (points >= 2) {
            return 2;
        }
        if (points >= 1) {
            return 1;
        }
        return 0;
    };
    return HelperClass;
}());
/// <reference path="IThreadEngine" />
/// <reference path="ThreadAction" />
/// <reference path="GameState" />
/// <reference path="Cell" />
var previousStats = (function () {
    function previousStats() {
        this.myCellCount = 1;
        this.opCellCount = 1;
        this.myTotal = 1;
        this.opTotal = 1;
    }
    return previousStats;
}());
//input is whole field
var AIEngine1 = (function () {
    function AIEngine1(ThreadID) {
        this.threadID = ThreadID;
        this.previousStats = new previousStats();
    }
    AIEngine1.getDescription = function () {
        return "Per cell change of 1/value to get into action. Select destination strategy: 1.free 2.enemy 3.own cell. Random transfer value";
    };
    AIEngine1.prototype.GetActions = function (state) {
        var _this = this;
        //
        //if (this.even == true) {
        //    this.even = false
        var result = [];
        //bekijken eigen cellen
        var myCells = state.CellsOfThread(this.threadID);
        var allCells = state.GetCells();
        myCells.forEach(function (mycell) {
            var inputArray = _this.cellsToNumberArray(allCells);
            inputArray.push(mycell.Row * state.dimension + mycell.Col);
            var action = brain.forward(inputArray);
            // action is a number in [0, num_actions) telling index of the action the agent chooses
            // here, apply the action on environment and observe some reward. Finally, communicate it:
            var otherplayer = _this.threadID == 1 ? 2 : 1;
            var ownedCells = allCells.filter(function (cell) { return cell.Owner == _this.threadID; });
            var cellTotal = 0;
            ownedCells.forEach(function (cell) {
                cellTotal += cell.Value;
            });
            var opCells = allCells.filter(function (cell) { return cell.Owner == otherplayer; });
            var opTotal = 0;
            opCells.forEach(function (cell) {
                opTotal += cell.Value;
            });
            //brain.backward(cellTotal - opTotal + 100 * (ownedCells.length - opCells.length)); // <-- learning magic happens here
            //brain.backward(((ownedCells.length-opCells.length) / 32));
            var deltaPoints = (cellTotal / _this.previousStats.myTotal) - (opTotal / _this.previousStats.opTotal);
            var deltaCells = (ownedCells.length / _this.previousStats.myCellCount) - (opCells.length / _this.previousStats.opCellCount);
            brain.backward(deltaPoints + 100 * deltaCells);
            _this.previousStats.myCellCount = ownedCells.length;
            _this.previousStats.opCellCount = opCells.length;
            _this.previousStats.myTotal = cellTotal;
            _this.previousStats.opTotal = opTotal;
            brain.epsilon_test_time = 0.0; // don't make any random choices, ever
            brain.learning = true;
            var action = brain.forward(inputArray); // get optimal action from learned policy
            var foo = _this.decodeAction(action, mycell, state);
            if (foo != null) {
                result.push(foo);
            }
            document.getElementById("index").innerHTML = (mycell.Row * state.dimension + mycell.Col).toString() + ":" + mycell.Row + "," + mycell.Col;
            document.getElementById("length").innerHTML = ownedCells.length + "," + opCells.length;
            document.getElementById("total").innerHTML = cellTotal + "," + opTotal;
            //console.log(surroundingCells);
        });
        var json = brain.value_net.toJSON();
        document.getElementById("jsonBox").value = JSON.stringify(json);
        brain.visSelf(document.getElementById("learnStats"));
        return result;
        //}
        //else {
        //    this.even = true;
        //    return result;
        //}
    };
    AIEngine1.prototype.Surrounding = function (state, row, col) {
        var result = [];
        var cells = state.CellsOfThread(this.threadID);
        //NW, W, SW
        if (col > 0) {
            result.push(cells[state.GetIndexFromPos(row, col - 1)]);
            if (row > 0) {
                result.push(cells[state.GetIndexFromPos(row - 1, col - 1)]);
            }
            if (row < state.dimension - 1) {
                result.push(cells[state.GetIndexFromPos(row + 1, col - 1)]);
            }
        }
        //N , S
        if (row > 0) {
            result.push(cells[state.GetIndexFromPos(row - 1, col)]);
        }
        if (row < state.dimension - 1) {
            result.push(cells[state.GetIndexFromPos(row + 1, col)]);
        }
        //NE , E , SE
        if (col < state.dimension - 1) {
            result.push(cells[state.GetIndexFromPos(row, col + 1)]);
            if (row > 0) {
                result.push(cells[state.GetIndexFromPos(row - 1, col + 1)]);
            }
            if (row < state.dimension - 1) {
                result.push(cells[state.GetIndexFromPos(row + 1, col + 1)]);
            }
        }
        return result;
    };
    AIEngine1.prototype.cellsToNumberArray = function (cells) {
        var numbers = [];
        cells.forEach(function (cell) {
            numbers.push(cell.Value / 255);
        });
        return numbers;
    };
    AIEngine1.prototype.pieter = function (cells, currentCell) {
        var _this = this;
        var num_inputs = 66; // 64 inputs + x and y for current position
        var num_actions = 9; // moveto surround position + do nothing // + amount
        var temporal_window = 1; // amount of temporal memory. 0 = agent lives in-the-moment :)
        var network_size = num_inputs * temporal_window + num_actions * temporal_window + num_inputs;
        // the value function network computes a value of taking any of the possible actions
        // given an input state. Here we specify one explicitly the hard way
        // but user could also equivalently instead use opt.hidden_layer_sizes = [20,20]
        // to just insert simple relu hidden layers.
        var layer_defs = [];
        layer_defs.push({ type: 'input', out_sx: 1, out_sy: 1, out_depth: network_size });
        layer_defs.push({ type: 'fc', num_neurons: 50, activation: 'relu' });
        layer_defs.push({ type: 'fc', num_neurons: 50, activation: 'relu' });
        layer_defs.push({ type: 'regression', num_neurons: num_actions });
        // options for the Temporal Difference learner that trains the above net
        // by backpropping the temporal difference learning rule.
        var tdtrainer_options = { learning_rate: 0.001, momentum: 0.0, batch_size: 64, l2_decay: 0.01 };
        var opt = {
            "temporal_window": temporal_window,
            "experience_size": 30000,
            "start_learn_threshold": 1000,
            "gamma": 0.7,
            "learning_steps_total": 200000,
            "learning_steps_burnin": 3000,
            "epsilon_min": 0.05,
            "epsilon_test_time": 0.05,
            "layer_defs": layer_defs,
            "tdtrainer_options": tdtrainer_options
        };
        var brain = new deepqlearn.Brain(num_inputs, num_actions, opt); // woohoo
        var inputArray = this.cellsToNumberArray(cells);
        inputArray.push(currentCell.Col);
        inputArray.push(currentCell.Row);
        var action = brain.forward(inputArray);
        // action is a number in [0, num_actions) telling index of the action the agent chooses
        // here, apply the action on environment and observe some reward. Finally, communicate it:
        var otherplayer = this.threadID == 1 ? 2 : 1;
        var ownedCells = cells.filter(function (cell) { return cell.Owner == _this.threadID; });
        var cellTotal = 0;
        ownedCells.forEach(function (cell) {
            cellTotal += cell.Value;
        });
        var opCells = cells.filter(function (cell) { return cell.Owner == otherplayer; });
        var opTotal = 0;
        opCells.forEach(function (cell) {
            opTotal += cell.Value;
        });
        brain.backward(cellTotal - opTotal + 5 * (ownedCells.length - opCells.length)); // <-- learning magic happens here
        brain.epsilon_test_time = 0.0; // don't make any random choices, ever
        brain.learning = true;
        var action = brain.forward(inputArray); // get optimal action from learned policy
        return action;
    };
    AIEngine1.prototype.sigmoid = function (t) {
        return 1 / (1 + Math.pow(Math.E, -t));
    };
    AIEngine1.prototype.decodeAction = function (action, cell, state) {
        var divider = 1.2;
        switch (action) {
            case 0: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row - 1) * state.dimension + (cell.Col - 1);
                if ((cell.Row - 1) < 0 || (cell.Col - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 1: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row - 1) * state.dimension + (cell.Col);
                if ((cell.Row - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 2: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row - 1) * state.dimension + (cell.Col + 1);
                if ((cell.Row - 1) < 0 || (cell.Col + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 3: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row) * state.dimension + (cell.Col - 1);
                if ((cell.Col - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 4: {
                return null;
            }
            case 5: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row) * state.dimension + (cell.Col + 1);
                if ((cell.Col + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 6: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row + 1) * state.dimension + (cell.Col - 1);
                if ((cell.Row + 1) >= state.dimension || (cell.Col - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 7: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row + 1) * state.dimension + (cell.Col);
                if ((cell.Row + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 8: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row + 1) * state.dimension + (cell.Col + 1);
                if ((cell.Row + 1) >= state.dimension || (cell.Col + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            default: {
                return null;
            }
        }
    };
    return AIEngine1;
}());
//input is block of surrounding
var AIEngine2 = (function () {
    function AIEngine2(ThreadID) {
        this.threadID = ThreadID;
        this.previousStats = new previousStats();
    }
    AIEngine2.getDescription = function () {
        return "Per cell change of 1/value to get into action. Select destination strategy: 1.free 2.enemy 3.own cell. Random transfer value";
    };
    AIEngine2.prototype.GetActions = function (state) {
        var _this = this;
        var result = [];
        //bekijken eigen cellen
        var myCells = state.CellsOfThread(this.threadID);
        var allCells = state.GetCells();
        myCells.forEach(function (mycell) {
            var inputArray = _this.Surrounding(state, mycell.Row, mycell.Col);
            //inputArray.push(mycell.Row * state.dimension + mycell.Col);
            for (var i = 0; i < inputArray.length; i++) {
                inputArray[i] = _this.sigmoid(inputArray[i] / 51);
            }
            var action = brain.forward(inputArray);
            // action is a number in [0, num_actions) telling index of the action the agent chooses
            // here, apply the action on environment and observe some reward. Finally, communicate it:
            var otherplayer = _this.threadID == 1 ? 2 : 1;
            var ownedCells = allCells.filter(function (cell) { return cell.Owner == _this.threadID; });
            var cellTotal = 0;
            ownedCells.forEach(function (cell) {
                cellTotal += cell.Value;
            });
            var opCells = allCells.filter(function (cell) { return cell.Owner == otherplayer; });
            var opTotal = 0;
            opCells.forEach(function (cell) {
                opTotal += cell.Value;
            });
            //brain.backward(cellTotal - opTotal + 100 * (ownedCells.length - opCells.length)); // <-- learning magic happens here
            //brain.backward(((ownedCells.length-opCells.length) / 32));
            var deltaPoints = (cellTotal - _this.previousStats.myTotal); // - (opTotal / this.previousStats.opTotal);
            var deltaCells = (ownedCells.length - _this.previousStats.myCellCount); // - (opCells.length / this.previousStats.opCellCount);
            brain.backward(ownedCells.length - opCells.length); // + 50 * deltaCells);
            _this.previousStats.myCellCount = ownedCells.length;
            _this.previousStats.opCellCount = opCells.length;
            _this.previousStats.myTotal = cellTotal;
            _this.previousStats.opTotal = opTotal;
            brain.epsilon_test_time = 0.0; // don't make any random choices, ever
            brain.learning = true;
            var action = brain.forward(inputArray); // get optimal action from learned policy
            var foo = _this.decodeAction(action, mycell, state);
            if (foo != null) {
                result.push(foo);
            }
            document.getElementById("index").innerHTML = (mycell.Row * state.dimension + mycell.Col).toString() + ":" + mycell.Row + "," + mycell.Col;
            document.getElementById("length").innerHTML = ownedCells.length + "," + opCells.length;
            document.getElementById("total").innerHTML = cellTotal + "," + opTotal;
            //console.log(surroundingCells);
        });
        var json = brain.value_net.toJSON();
        document.getElementById("jsonBox").value = JSON.stringify(json);
        brain.visSelf(document.getElementById("learnStats"));
        return result;
    };
    AIEngine2.prototype.Surrounding = function (state, row, col) {
        var result = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        var cells = state.GetCells();
        result[4] = cells[state.GetIndexFromPos(row, col)].Value;
        //NW, W, SW
        if (col > 0) {
            result[3] = cells[state.GetIndexFromPos(row, col - 1)].Value;
            if (row > 0) {
                result[0] = cells[state.GetIndexFromPos(row - 1, col - 1)].Value;
            }
            if (row < state.dimension - 1) {
                result[6] = cells[state.GetIndexFromPos(row + 1, col - 1)].Value;
            }
        }
        //N , S
        if (row > 0) {
            result[1] = cells[state.GetIndexFromPos(row - 1, col)].Value;
        }
        if (row < state.dimension - 1) {
            result[7] = cells[state.GetIndexFromPos(row + 1, col)].Value;
        }
        //NE , E , SE
        if (col < state.dimension - 1) {
            result[5] = cells[state.GetIndexFromPos(row, col + 1)].Value;
            if (row > 0) {
                result[2] = cells[state.GetIndexFromPos(row - 1, col + 1)].Value;
            }
            if (row < state.dimension - 1) {
                result[8] = cells[state.GetIndexFromPos(row + 1, col + 1)].Value;
            }
        }
        return result;
    };
    AIEngine2.prototype.cellsToNumberArray = function (cells) {
        var numbers = [];
        cells.forEach(function (cell) {
            numbers.push(cell.Value / 255);
        });
        return numbers;
    };
    AIEngine2.prototype.sigmoid = function (t) {
        return 1 / (1 + Math.pow(Math.E, -t));
    };
    AIEngine2.prototype.decodeAction = function (action, cell, state) {
        var divider = 1.2;
        switch (action) {
            case 0: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row - 1) * state.dimension + (cell.Col - 1);
                if ((cell.Row - 1) < 0 || (cell.Col - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 1: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row - 1) * state.dimension + (cell.Col);
                if ((cell.Row - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 2: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row - 1) * state.dimension + (cell.Col + 1);
                if ((cell.Row - 1) < 0 || (cell.Col + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 3: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row) * state.dimension + (cell.Col - 1);
                if ((cell.Col - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 4: {
                return null;
            }
            case 5: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row) * state.dimension + (cell.Col + 1);
                if ((cell.Col + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 6: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row + 1) * state.dimension + (cell.Col - 1);
                if ((cell.Row + 1) >= state.dimension || (cell.Col - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 7: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row + 1) * state.dimension + (cell.Col);
                if ((cell.Row + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 8: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row + 1) * state.dimension + (cell.Col + 1);
                if ((cell.Row + 1) >= state.dimension || (cell.Col + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            default: {
                return null;
            }
        }
    };
    return AIEngine2;
}());
var AIEngine3 = (function () {
    function AIEngine3(ThreadID) {
        this.threadID = ThreadID;
        this.previousStats = new previousStats();
    }
    AIEngine3.getDescription = function () {
        return "Per cell change of 1/value to get into action. Select destination strategy: 1.free 2.enemy 3.own cell. Random transfer value";
    };
    AIEngine3.prototype.GetActions = function (state) {
        var _this = this;
        var result = [];
        //bekijken eigen cellen
        var myCells = state.CellsOfThread(this.threadID);
        var allCells = state.GetCells();
        var otherplayer = this.threadID == 1 ? 2 : 1;
        //var brain = new deepqlearn.Brain(9, 8, 9);
        //myCells.forEach((mycell) => {
        //    var action = brain.forward(this.Surrounding(state, mycell.Row, mycell.Col));
        //    var points = 0;
        //    if (action == 4) {
        //        points += 5;
        //    }
        //    else {
        //        var owner = allCells[state.GetIndexFromPos(Math.floor(action / 3), action % 3)].Owner
        //        if (owner == otherplayer) {
        //            points += 10;
        //        }
        //        else if (owner == this.threadID) {
        //            points -= 10;
        //        }
        //        else {
        //            points += 5;
        //        }
        //    }
        //});
        myCells.forEach(function (mycell) {
            var inputArray = _this.Surrounding(state, mycell.Row, mycell.Col);
            //inputArray.push(mycell.Row * state.dimension + mycell.Col);
            for (var i = 0; i < inputArray.length; i++) {
                inputArray[i] = _this.sigmoid(inputArray[i] / 51);
            }
            var action = brain.forward(inputArray);
            var points = 0;
            var ownedCells = allCells.filter(function (cell) { return cell.Owner == _this.threadID; });
            var cellTotal = 0;
            ownedCells.forEach(function (cell) {
                cellTotal += cell.Value;
            });
            var opCells = allCells.filter(function (cell) { return cell.Owner == otherplayer; });
            var opTotal = 0;
            opCells.forEach(function (cell) {
                opTotal += cell.Value;
            });
            if (action == 4) {
                points += (30 - mycell.Value / 255);
            }
            else {
                if (_this.decodeAction(action, mycell, state) != null) {
                    var owner = allCells[state.GetIndexFromPos(mycell.Row + Math.floor(action / 3) - 1, mycell.Col + (action % 3) - 1)].Owner;
                    if (owner == otherplayer) {
                        points += 10;
                    }
                    else if (owner == _this.threadID) {
                        points -= 20;
                    }
                    else {
                        points += 5;
                    }
                }
                else {
                    points -= 100;
                }
            }
            if (cellTotal - _this.previousStats.myTotal >= 0) {
                points += 10;
            }
            else {
                points -= 10;
            }
            if (ownedCells.length - _this.previousStats.myCellCount >= 0) {
                points += 10;
            }
            else {
                points -= 10;
            }
            // action is a number in [0, num_actions) telling index of the action the agent chooses
            // here, apply the action on environment and observe some reward. Finally, communicate it:
            ////brain.backward(cellTotal - opTotal + 100 * (ownedCells.length - opCells.length)); // <-- learning magic happens here
            ////brain.backward(((ownedCells.length-opCells.length) / 32));
            //var deltaPoints = (cellTotal - this.previousStats.myTotal);// - (opTotal / this.previousStats.opTotal);
            //var deltaCells = (ownedCells.length - this.previousStats.myCellCount);// - (opCells.length / this.previousStats.opCellCount);
            brain.backward(points); // + 50 * deltaCells);
            _this.previousStats.myCellCount = ownedCells.length;
            _this.previousStats.opCellCount = opCells.length;
            _this.previousStats.myTotal = cellTotal;
            _this.previousStats.opTotal = opTotal;
            brain.epsilon_test_time = 0.0; // don't make any random choices, ever
            brain.learning = true;
            var action = brain.forward(inputArray); // get optimal action from learned policy
            var foo = _this.decodeAction(action, mycell, state);
            if (foo != null) {
                result.push(foo);
            }
            document.getElementById("index").innerHTML = (mycell.Row * state.dimension + mycell.Col).toString() + ":" + mycell.Row + "," + mycell.Col;
            //(<HTMLInputElement>document.getElementById("length")).innerHTML = ownedCells.length + "," + opCells.length;
            //(<HTMLInputElement>document.getElementById("total")).innerHTML = cellTotal + "," + opTotal;
            //console.log(surroundingCells);
        });
        var json = brain.value_net.toJSON();
        document.getElementById("jsonBox").value = JSON.stringify(json);
        brain.visSelf(document.getElementById("learnStats"));
        return result;
    };
    AIEngine3.prototype.Surrounding = function (state, row, col) {
        var result = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        var cells = state.GetCells();
        result[4] = cells[state.GetIndexFromPos(row, col)].Value;
        //NW, W, SW
        if (col > 0) {
            result[3] = cells[state.GetIndexFromPos(row, col - 1)].Value;
            if (row > 0) {
                result[0] = cells[state.GetIndexFromPos(row - 1, col - 1)].Value;
            }
            if (row < state.dimension - 1) {
                result[6] = cells[state.GetIndexFromPos(row + 1, col - 1)].Value;
            }
        }
        //N , S
        if (row > 0) {
            result[1] = cells[state.GetIndexFromPos(row - 1, col)].Value;
        }
        if (row < state.dimension - 1) {
            result[7] = cells[state.GetIndexFromPos(row + 1, col)].Value;
        }
        //NE , E , SE
        if (col < state.dimension - 1) {
            result[5] = cells[state.GetIndexFromPos(row, col + 1)].Value;
            if (row > 0) {
                result[2] = cells[state.GetIndexFromPos(row - 1, col + 1)].Value;
            }
            if (row < state.dimension - 1) {
                result[8] = cells[state.GetIndexFromPos(row + 1, col + 1)].Value;
            }
        }
        return result;
    };
    AIEngine3.prototype.cellsToNumberArray = function (cells) {
        var numbers = [];
        cells.forEach(function (cell) {
            numbers.push(cell.Value / 255);
        });
        return numbers;
    };
    AIEngine3.prototype.sigmoid = function (t) {
        return 1 / (1 + Math.pow(Math.E, -t));
    };
    AIEngine3.prototype.decodeAction = function (action, cell, state) {
        var divider = 1.2;
        switch (action) {
            case 0: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row - 1) * state.dimension + (cell.Col - 1);
                if ((cell.Row - 1) < 0 || (cell.Col - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 1: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row - 1) * state.dimension + (cell.Col);
                if ((cell.Row - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 2: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row - 1) * state.dimension + (cell.Col + 1);
                if ((cell.Row - 1) < 0 || (cell.Col + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 3: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row) * state.dimension + (cell.Col - 1);
                if ((cell.Col - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 4: {
                return null;
            }
            case 5: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row) * state.dimension + (cell.Col + 1);
                if ((cell.Col + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 6: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row + 1) * state.dimension + (cell.Col - 1);
                if ((cell.Row + 1) >= state.dimension || (cell.Col - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 7: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row + 1) * state.dimension + (cell.Col);
                if ((cell.Row + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 8: {
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row + 1) * state.dimension + (cell.Col + 1);
                if ((cell.Row + 1) >= state.dimension || (cell.Col + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            default: {
                return null;
            }
        }
    };
    return AIEngine3;
}());
/// <reference path="IThreadEngine" />
/// <reference path="ThreadAction" />
/// <reference path="GameState" />
/// <reference path="Cell" />
var SimpleEngine = (function () {
    function SimpleEngine(ThreadID) {
        this.threadID = ThreadID;
    }
    SimpleEngine.prototype.GetActions = function (state) {
        var _this = this;
        var result = [];
        //bekijken eigen cellen
        var myCells = state.CellsOfThread(this.threadID);
        myCells.forEach(function (mycell) {
            if (mycell.Value > 1) {
                if (Math.random() > 0.7) {
                    //get valid surrounding cells
                    var surroundingCells = state.GetCellsAround(mycell.Row, mycell.Col);
                    var dest = surroundingCells[0];
                    //pick random cell.
                    var ndx = Math.floor(Math.random() * surroundingCells.length);
                    dest = surroundingCells[ndx];
                    //transfer 50% of the current value
                    var transferValue = Math.floor(mycell.Value / 2);
                    //record our action
                    var sourceIndex = mycell.Row * state.dimension + mycell.Col;
                    var destIndex = dest.Row * state.dimension + dest.Col;
                    result.push(new ThreadAction(_this.threadID, sourceIndex, destIndex, transferValue));
                }
            }
        });
        return result;
    };
    return SimpleEngine;
}());
var SampleEngine = (function () {
    function SampleEngine(ThreadID) {
        this.threadID = ThreadID;
    }
    SampleEngine.getDescription = function () {
        return "Per cell change of 1/value to get into action. Select destination strategy: 1.free 2.enemy 3.own cell. Random transfer value";
    };
    SampleEngine.prototype.GetActions = function (state) {
        var _this = this;
        //
        var result = [];
        //bekijken eigen cellen
        var myCells = state.CellsOfThread(this.threadID);
        myCells.forEach(function (mycell) {
            if (mycell.Value > 1) {
                //kans van 2 tot 255 
                if (Math.random() > (1.0 - (mycell.Value / 255.0))) {
                    //omliggende cellen opvragren en pick er eentje..
                    var surroundingCells = state.GetCellsAround(mycell.Row, mycell.Col);
                    var dest = surroundingCells[0];
                    //pick random cell.
                    var emptySourrce = surroundingCells.filter(function (c) { return c.Owner == 0; });
                    var otherPlayer = _this.threadID == 1 ? 2 : 1;
                    if (emptySourrce.length > 0) {
                        var ndx = Math.floor(Math.random() * emptySourrce.length);
                        dest = emptySourrce[ndx];
                    }
                    else {
                        var enenySource = surroundingCells.filter(function (c) { return c.Owner == otherPlayer; });
                        if (enenySource.length > 0) {
                            var ndx = Math.floor(Math.random() * enenySource.length);
                            dest = enenySource[ndx];
                        }
                        else {
                            var ndx = Math.floor(Math.random() * surroundingCells.length);
                            dest = surroundingCells[ndx];
                        }
                    }
                    //pick random value to transfer
                    var transferValue = Math.floor(Math.random() * (mycell.Value - 1)) + 1;
                    //leg de actie vast
                    var sourceIndex = mycell.Row * state.dimension + mycell.Col;
                    var destIndex = dest.Row * state.dimension + dest.Col;
                    result.push(new ThreadAction(_this.threadID, sourceIndex, destIndex, transferValue));
                }
            }
        });
        return result;
    };
    return SampleEngine;
}());
//# sourceMappingURL=app.js.map
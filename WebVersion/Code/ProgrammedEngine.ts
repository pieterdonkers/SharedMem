/// <reference path="IThreadEngine" />
/// <reference path="ThreadAction" />
/// <reference path="GameState" />
/// <reference path="Cell" />


class ProgrammedEngine1 implements IThreadEngine {

    private threadID: number;

    constructor(ThreadID: number) {
        this.threadID = ThreadID
    }

    static getDescription(): string {
        return "Per cell change of 1/value to get into action. Select destination strategy: 1.free 2.enemy 3.own cell. Random transfer value";
    }

    public GetActions(state: GameState): ThreadAction[] {
        //
        var result: ThreadAction[] = [];

        //bekijken eigen cellen
        var myCells = state.CellsOfThread(this.threadID);

        myCells.forEach((mycell) => {
            
            if (mycell.Value > 1) {
                //kans van 2 tot 255 
                if (Math.random() > (1.0 - (mycell.Value / 255.0))) {
                    //omliggende cellen opvragren en pick er eentje..
                    var surroundingCells = state.GetCellsAround(mycell.Row, mycell.Col);

                    var dest: Cell = surroundingCells[0];
                    for (var i = 1; i < surroundingCells.length; i++) {
                        if (surroundingCells[i].Value < dest.Value) {
                            dest = surroundingCells[i];
                        }
                    }
                    var total = state.CellsValue(this.threadID);
                    var ocupied = state.CellsOccupied(this.threadID);
                    //pick random cell.

                    var emptySourrce = surroundingCells.filter((c) => c.Owner == 0);
                    var otherPlayer: number = this.threadID == 1 ? 2 : 1;
                    if (emptySourrce.length > 0) {
                        var ndx = Math.floor(Math.random() * emptySourrce.length);
                        dest = emptySourrce[ndx];
                    }
                    else {
                        var enemySource = surroundingCells.filter((c) => c.Owner == otherPlayer);
                        if (enemySource.length > 0) {
                            var ndx = Math.floor(Math.random() * enemySource.length);
                            dest = enemySource[ndx];
                        } else {
                            var ndx = Math.floor(Math.random() * surroundingCells.length);
                            dest = surroundingCells[ndx];
                        }
                    }


                    //pick random value to transfer
                    var transferValue = Math.floor(Math.random() * (mycell.Value - 1)) + 1;
                    transferValue = Math.floor(mycell.Value*0.9) - 1;

                    //leg de actie vast
                    var sourceIndex: number = mycell.Row * state.dimension + mycell.Col;
                    var destIndex: number = dest.Row * state.dimension + dest.Col;
                    result.push(new ThreadAction(this.threadID, sourceIndex, destIndex, transferValue));


                }
            }
        });

        return result;
    }
}

class ProgrammedEngine2 implements IThreadEngine {

    private threadID: number;

    constructor(ThreadID: number) {
        this.threadID = ThreadID
    }

    static getDescription(): string {
        return "Per cell change of 1/value to get into action. Select destination strategy: 1.free 2.enemy 3.own cell. Random transfer value";
    }

    public GetActions(state: GameState): ThreadAction[] {
        //
        var result: ThreadAction[] = [];

        //bekijken eigen cellen
        var myCells = state.CellsOfThread(this.threadID);
        var otherPlayer: number = this.threadID == 1 ? 2 : 1;

        myCells.forEach((mycell) => {
            var skipthis = false;
            if (mycell.Value > 1) {
                //get all cells connected to current cell
                var surroundingCells = state.GetCellsAround(mycell.Row, mycell.Col);

                //by default pick the cell with the lowest value
                var dest: Cell = surroundingCells[0];
                surroundingCells.forEach(cell => {
                    if (cell.Value < dest.Value) {
                        dest = cell;
                    }
                });

                //total value of all owned cells
                var total = state.CellsValue(this.threadID);
                //number of owned cells
                var ocupied = state.CellsOccupied(this.threadID);
                //get the average value of the cells
                var average = ocupied != 0 ? total / ocupied : 0;

                //connecting cells not owned by either players
                var emptyCells = surroundingCells.filter((c) => c.Owner == 0);
                //connecting cells owned by enemy
                var enemyCells = surroundingCells.filter((c) => c.Owner == otherPlayer);

                //get the nearest enemy cell
                var nearestEnemy = HelperClass.nearestEnemy(state, mycell, this.threadID);
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
                                dest = enemyCells[0]
                                enemyCells.forEach(cell => {
                                    dest = cell.Value < dest.Value ? cell : dest;
                                })
                            } else {
                                //var ndx = Math.floor(Math.random() * surroundingCells.length);
                                //dest = surroundingCells[ndx];
                                surroundingCells.forEach(cell => {
                                    dest = cell.Value < dest.Value ? cell : dest;
                                });
                            }
                        }
                    }

                    //pick random value to transfer
                    var transferValue;// = Math.floor(Math.random() * (mycell.Value - 1)) + 1;
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
                    //if the transfer is to an already owned cell
                    else if (dest.Owner == this.threadID) {
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
                    //transfering to an empty cell
                    else {
                        transferValue = Math.floor(mycell.Value * 0.9) - 1;
                    }
                    //leg de actie vast
                    if (skipthis == false) {
                        var sourceIndex: number = mycell.Row * state.dimension + mycell.Col;
                        var destIndex: number = dest.Row * state.dimension + dest.Col;
                        result.push(new ThreadAction(this.threadID, sourceIndex, destIndex, transferValue));
                    }
                }
            }
        });
        return result;
    }
}

class ProgrammedEngine3 implements IThreadEngine {

    private threadID: number;

    constructor(ThreadID: number) {
        this.threadID = ThreadID
    }

    static getDescription(): string {
        return "Per cell change of 1/value to get into action. Select destination strategy: 1.free 2.enemy 3.own cell. Random transfer value";
    }

    public GetActions(state: GameState): ThreadAction[] {
        //
        var result: ThreadAction[] = [];

        //bekijken eigen cellen
        var myCells = state.CellsOfThread(this.threadID);
        var otherPlayer: number = this.threadID == 1 ? 2 : 1;

        myCells.forEach((mycell) => {
            var skipthis = false;
            if (mycell.Value > 1) {
                //get all cells connected to current cell
                var surroundingCells = state.GetCellsAround(mycell.Row, mycell.Col);

                //by default pick the cell with the lowest value
                var dest: Cell = surroundingCells[0];
                surroundingCells.forEach(cell => {
                    if (cell.Value < dest.Value) {
                        dest = cell;
                    }
                });

                //total value of all owned cells
                var total = state.CellsValue(this.threadID);
                //number of owned cells
                var ocupied = state.CellsOccupied(this.threadID);
                //get the average value of the cells
                var average = ocupied != 0 ? total / ocupied : 0;

                //connecting cells not owned by either players
                var emptyCells = surroundingCells.filter((c) => c.Owner == 0);
                //connecting cells owned by enemy
                var enemyCells = surroundingCells.filter((c) => c.Owner == otherPlayer);

                //get the nearest enemy cell
                var nearestEnemy = HelperClass.nearestEnemy(state, mycell, this.threadID);
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
                                dest = enemyCells[0]
                                enemyCells.forEach(cell => {
                                    dest = cell.Value < dest.Value ? cell : dest;
                                })
                            } else {
                                //var ndx = Math.floor(Math.random() * surroundingCells.length);
                                //dest = surroundingCells[ndx];
                                surroundingCells.forEach(cell => {
                                    dest = cell.Value < dest.Value ? cell : dest;
                                });
                            }
                        }
                    }

                    //pick random value to transfer
                    var transferValue;// = Math.floor(Math.random() * (mycell.Value - 1)) + 1;
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
                    //if the transfer is to an already owned cell
                    else if (dest.Owner == this.threadID) {
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
                    //transfering to an empty cell
                    else {
                        transferValue = Math.floor(mycell.Value * 0.9) - 1;
                    }

                    //if there is already an action to the destination check if it is the 
                    result.forEach(action => {
                        if (state.GetIndexFromPos(dest.Row, dest.Col) == action.destIndex) {
                            //if (transferValue > action.count) {
                            //    result = result.filter(filt => filt != action);
                            //}
                            if (HelperClass.cellDistance(nearestEnemy, mycell) < HelperClass.cellDistance(nearestEnemy, state.GetCellByIndex(action.sourceIndex))) {
                                result = result.filter(filt => filt != action);
                            }
                        }
                    })
                    //leg de actie vast
                    if (skipthis == false) {
                        var sourceIndex: number = mycell.Row * state.dimension + mycell.Col;
                        var destIndex: number = dest.Row * state.dimension + dest.Col;
                        result.push(new ThreadAction(this.threadID, sourceIndex, destIndex, transferValue));
                    }
                }
            }
        });
        return result;
    }
}


class HelperClass {
    public static nearestEnemy(state: GameState, curCell: Cell, owner : number): Cell {
        var allCells = state.GetCells();
        var distance = 100;
        var nearestCell = new Cell(curCell.Row, curCell.Col);
        var enemy = owner == 1 ? 2 : 1;

        allCells.forEach(cell => {
            if (cell.Owner == enemy) {
                var curDistance = this.cellDistance(curCell, cell);
                if (curDistance < distance) {
                    distance = curDistance;
                    nearestCell = cell;
                }
            }
        });
        return nearestCell;
    }

    public static cellDistance(cellA: Cell, cellB: Cell): number {
        var distance = Math.pow(cellA.Row - cellB.Row, 2) + Math.pow(cellA.Col - cellB.Col, 2);
        return Math.abs(Math.sqrt(distance));
    }

    public static attackDirection(cellA: Cell, cellB: Cell, state: GameState): Cell {
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
    }

    public static gain (points: number): number {
        if (points >= 128) { return 8;}
        if (points >= 64) { return 7; }
        if (points >= 32) { return 6; }
        if (points >= 16) { return 5; }
        if (points >= 8) { return 4; }
        if (points >= 4) { return 3; }
        if (points >= 2) { return 2; }
        if (points >= 1) { return 1; }
        return 0;
    }
}
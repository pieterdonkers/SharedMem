/// <reference path="IThreadEngine" />
/// <reference path="ThreadAction" />
/// <reference path="GameState" />
/// <reference path="Cell" />
declare var deepqlearn: any; // Magic
declare var brain: any;

class previousStats {
    public myCellCount: number;
    public opCellCount: number;
    public myTotal: number;
    public opTotal: number;

    constructor() {
        this.myCellCount = 1;
        this.opCellCount = 1;
        this.myTotal = 1;
        this.opTotal = 1;
    }
}

//input is whole field
class AIEngine1 implements IThreadEngine {

    private threadID: number;

    private previousStats: previousStats;

    constructor(ThreadID: number) {
        this.threadID = ThreadID
        this.previousStats = new previousStats();
    }

    static getDescription(): string {
        return "Per cell change of 1/value to get into action. Select destination strategy: 1.free 2.enemy 3.own cell. Random transfer value";
    }
    private even: boolean;
    public GetActions(state: GameState): ThreadAction[] {
        //
        //if (this.even == true) {
        //    this.even = false
            var result: ThreadAction[] = [];

            //bekijken eigen cellen
            var myCells = state.CellsOfThread(this.threadID);
            var allCells = state.GetCells();


            myCells.forEach((mycell) => {
                var inputArray = this.cellsToNumberArray(allCells);
                inputArray.push(mycell.Row * state.dimension + mycell.Col);
                var action = brain.forward(inputArray);
                // action is a number in [0, num_actions) telling index of the action the agent chooses
                // here, apply the action on environment and observe some reward. Finally, communicate it:

                var otherplayer = this.threadID == 1 ? 2 : 1;

                var ownedCells = allCells.filter(cell => cell.Owner == this.threadID);
                var cellTotal = 0;
                ownedCells.forEach(cell => {
                    cellTotal += cell.Value;
                });
                var opCells = allCells.filter(cell => cell.Owner == otherplayer);
                var opTotal = 0;
                opCells.forEach(cell => {
                    opTotal += cell.Value;
                });

                //brain.backward(cellTotal - opTotal + 100 * (ownedCells.length - opCells.length)); // <-- learning magic happens here
                //brain.backward(((ownedCells.length-opCells.length) / 32));
                var deltaPoints = (cellTotal / this.previousStats.myTotal) - (opTotal / this.previousStats.opTotal);
                var deltaCells = (ownedCells.length / this.previousStats.myCellCount) - (opCells.length / this.previousStats.opCellCount);
                brain.backward(deltaPoints + 100 * deltaCells);

                this.previousStats.myCellCount = ownedCells.length;
                this.previousStats.opCellCount = opCells.length;
                this.previousStats.myTotal = cellTotal;
                this.previousStats.opTotal = opTotal;

                brain.epsilon_test_time = 0.0; // don't make any random choices, ever
                brain.learning = true;

                var action = brain.forward(inputArray); // get optimal action from learned policy

                var foo = this.decodeAction(action, mycell, state);
                if (foo != null) {
                    result.push(foo);
                }
                (<HTMLInputElement>document.getElementById("index")).innerHTML = (mycell.Row * state.dimension + mycell.Col).toString() + ":" + mycell.Row + "," + mycell.Col;
                (<HTMLInputElement>document.getElementById("length")).innerHTML = ownedCells.length + "," + opCells.length;
                (<HTMLInputElement>document.getElementById("total")).innerHTML = cellTotal + "," + opTotal;
                //console.log(surroundingCells);

            });
            var json = brain.value_net.toJSON();
            (<HTMLInputElement>document.getElementById("jsonBox")).value = JSON.stringify(json);
            brain.visSelf((<HTMLInputElement>document.getElementById("learnStats")));
            return result;
        //}
        //else {
        //    this.even = true;
        //    return result;
        //}
    }


    public Surrounding(state: GameState, row: number, col: number): Cell[] {
        var result: Cell[] = [];
        var cells = state.CellsOfThread(this.threadID);

        //NW, W, SW
        if (col > 0) {
            result.push(cells[state.GetIndexFromPos(row, col - 1)]);
            if (row > 0) { result.push(cells[state.GetIndexFromPos(row - 1, col - 1)]); }
            if (row < state.dimension - 1) { result.push(cells[state.GetIndexFromPos(row + 1, col - 1)]); }
        }
        //N , S
        if (row > 0) { result.push(cells[state.GetIndexFromPos(row - 1, col)]); }
        if (row < state.dimension - 1) { result.push(cells[state.GetIndexFromPos(row + 1, col)]); }
        //NE , E , SE
        if (col < state.dimension - 1) {
            result.push(cells[state.GetIndexFromPos(row, col + 1)]);
            if (row > 0) { result.push(cells[state.GetIndexFromPos(row - 1, col + 1)]); }
            if (row < state.dimension - 1) { result.push(cells[state.GetIndexFromPos(row + 1, col + 1)]); }
        }
        return result;
    }

    public cellsToNumberArray(cells: Cell[]): number[] {
        var numbers = [];

        cells.forEach((cell) => {
            numbers.push(cell.Value/255);
        });
        return numbers;

    }

    public pieter(cells: Cell[], currentCell: Cell): number {

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
        }

        var brain = new deepqlearn.Brain(num_inputs, num_actions, opt); // woohoo
        
        var inputArray = this.cellsToNumberArray(cells);
        inputArray.push(currentCell.Col);
        inputArray.push(currentCell.Row);
        var action = brain.forward(inputArray);
        // action is a number in [0, num_actions) telling index of the action the agent chooses
        // here, apply the action on environment and observe some reward. Finally, communicate it:

        var otherplayer = this.threadID == 1 ? 2 : 1;

        var ownedCells = cells.filter(cell => cell.Owner == this.threadID);
        var cellTotal = 0;
        ownedCells.forEach(cell => {
            cellTotal += cell.Value;
        });
        var opCells = cells.filter(cell => cell.Owner == otherplayer);
        var opTotal = 0;
        opCells.forEach(cell => {
            opTotal += cell.Value;
        });

        brain.backward(cellTotal - opTotal + 5*(ownedCells.length - opCells.length)); // <-- learning magic happens here


        brain.epsilon_test_time = 0.0; // don't make any random choices, ever
        brain.learning = true;
        var action = brain.forward(inputArray); // get optimal action from learned policy

        return action;
    }
    public sigmoid(t : number) : number {
        return 1 / (1 + Math.pow(Math.E, -t));
    }

    public decodeAction(action: number, cell: Cell, state: GameState): ThreadAction {
        var divider = 1.2;
        switch (action) {
            case 0: {   //LT
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row - 1) * state.dimension + (cell.Col - 1);
                if ((cell.Row - 1) < 0 || (cell.Col - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex , destIndex, Math.floor(cell.Value/divider));
            }
            case 1: {   //MT
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row - 1) * state.dimension + (cell.Col);
                if ((cell.Row - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 2: {   //RT
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row - 1) * state.dimension + (cell.Col + 1);
                if ((cell.Row - 1) < 0 || (cell.Col + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 3: {   //LM
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row) * state.dimension + (cell.Col - 1);
                if ((cell.Col - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 4: {   //Do nothing
                return null;
            }
            case 5: {   //RM
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row) * state.dimension + (cell.Col + 1);
                if ((cell.Col + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 6: {   //LB
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row + 1) * state.dimension + (cell.Col - 1);
                if ((cell.Row + 1) >= state.dimension || (cell.Col - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 7: {   //MB
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row + 1) * state.dimension + (cell.Col);
                if ((cell.Row + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 8: {   //RB
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
    }
}


//input is block of surrounding
class AIEngine2 implements IThreadEngine {

    private threadID: number;

    private previousStats: previousStats;

    constructor(ThreadID: number) {
        this.threadID = ThreadID
        this.previousStats = new previousStats();
    }

    static getDescription(): string {
        return "Per cell change of 1/value to get into action. Select destination strategy: 1.free 2.enemy 3.own cell. Random transfer value";
    }
    private even: boolean;
    public GetActions(state: GameState): ThreadAction[] {
        var result: ThreadAction[] = [];

        //bekijken eigen cellen
        var myCells = state.CellsOfThread(this.threadID);
        var allCells = state.GetCells();


        myCells.forEach((mycell) => {
            var inputArray = this.Surrounding(state, mycell.Row, mycell.Col);
            //inputArray.push(mycell.Row * state.dimension + mycell.Col);
            for (var i = 0; i < inputArray.length; i++) {
                inputArray[i] = this.sigmoid(inputArray[i]/51);
            }
            var action = brain.forward(inputArray);
            // action is a number in [0, num_actions) telling index of the action the agent chooses
            // here, apply the action on environment and observe some reward. Finally, communicate it:

            var otherplayer = this.threadID == 1 ? 2 : 1;

            var ownedCells = allCells.filter(cell => cell.Owner == this.threadID);
            var cellTotal = 0;
            ownedCells.forEach(cell => {
                cellTotal += cell.Value;
            });
            var opCells = allCells.filter(cell => cell.Owner == otherplayer);
            var opTotal = 0;
            opCells.forEach(cell => {
                opTotal += cell.Value;
            });

            //brain.backward(cellTotal - opTotal + 100 * (ownedCells.length - opCells.length)); // <-- learning magic happens here
            //brain.backward(((ownedCells.length-opCells.length) / 32));
            var deltaPoints = (cellTotal - this.previousStats.myTotal);// - (opTotal / this.previousStats.opTotal);
            var deltaCells = (ownedCells.length - this.previousStats.myCellCount);// - (opCells.length / this.previousStats.opCellCount);
            brain.backward(ownedCells.length-opCells.length);// + 50 * deltaCells);

            this.previousStats.myCellCount = ownedCells.length;
            this.previousStats.opCellCount = opCells.length;
            this.previousStats.myTotal = cellTotal;
            this.previousStats.opTotal = opTotal;

            brain.epsilon_test_time = 0.0; // don't make any random choices, ever
            brain.learning = true;

            var action = brain.forward(inputArray); // get optimal action from learned policy

            var foo = this.decodeAction(action, mycell, state);
            if (foo != null) {
                result.push(foo);
            }
            (<HTMLInputElement>document.getElementById("index")).innerHTML = (mycell.Row * state.dimension + mycell.Col).toString() + ":" + mycell.Row + "," + mycell.Col;
            (<HTMLInputElement>document.getElementById("length")).innerHTML = ownedCells.length + "," + opCells.length;
            (<HTMLInputElement>document.getElementById("total")).innerHTML = cellTotal + "," + opTotal;
            //console.log(surroundingCells);

        });
        var json = brain.value_net.toJSON();
        (<HTMLInputElement>document.getElementById("jsonBox")).value = JSON.stringify(json);
        brain.visSelf((<HTMLInputElement>document.getElementById("learnStats")));
        return result;
    }


    public Surrounding(state: GameState, row: number, col: number): number[] {
        var result: number[] = [0,0,0,0,0,0,0,0,0];
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
    }

    public cellsToNumberArray(cells: Cell[]): number[] {
        var numbers = [];

        cells.forEach((cell) => {
            numbers.push(cell.Value / 255);
        });
        return numbers;

    }

    public sigmoid(t: number): number {
        return 1 / (1 + Math.pow(Math.E, -t));
    }

    public decodeAction(action: number, cell: Cell, state: GameState): ThreadAction {
        var divider = 1.2;
        switch (action) {
            case 0: {   //LT
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row - 1) * state.dimension + (cell.Col - 1);
                if ((cell.Row - 1) < 0 || (cell.Col - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 1: {   //MT
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row - 1) * state.dimension + (cell.Col);
                if ((cell.Row - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 2: {   //RT
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row - 1) * state.dimension + (cell.Col + 1);
                if ((cell.Row - 1) < 0 || (cell.Col + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 3: {   //LM
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row) * state.dimension + (cell.Col - 1);
                if ((cell.Col - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 4: {   //Do nothing
                return null;
            }
            case 5: {   //RM
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row) * state.dimension + (cell.Col + 1);
                if ((cell.Col + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 6: {   //LB
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row + 1) * state.dimension + (cell.Col - 1);
                if ((cell.Row + 1) >= state.dimension || (cell.Col - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 7: {   //MB
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row + 1) * state.dimension + (cell.Col);
                if ((cell.Row + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 8: {   //RB
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
    }
}

class AIEngine3 implements IThreadEngine {

    private threadID: number;

    private previousStats: previousStats;

    constructor(ThreadID: number) {
        this.threadID = ThreadID
        this.previousStats = new previousStats();
    }

    static getDescription(): string {
        return "Per cell change of 1/value to get into action. Select destination strategy: 1.free 2.enemy 3.own cell. Random transfer value";
    }
    private even: boolean;
    public GetActions(state: GameState): ThreadAction[] {
        var result: ThreadAction[] = [];

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



        myCells.forEach((mycell) => {
            var inputArray = this.Surrounding(state, mycell.Row, mycell.Col);
            //inputArray.push(mycell.Row * state.dimension + mycell.Col);
            for (var i = 0; i < inputArray.length; i++) {
                inputArray[i] = this.sigmoid(inputArray[i] / 51);
            }
            var action = brain.forward(inputArray);
            var points = 0;

            var ownedCells = allCells.filter(cell => cell.Owner == this.threadID);
            var cellTotal = 0;
            ownedCells.forEach(cell => {
                cellTotal += cell.Value;
            });
            var opCells = allCells.filter(cell => cell.Owner == otherplayer);
            var opTotal = 0;
            opCells.forEach(cell => {
                opTotal += cell.Value;
            });


            if (action == 4) {
                
                points += (30- mycell.Value / 255);
                //points += 5;
            }
            else {
                if (this.decodeAction(action, mycell, state) != null) {
                    var owner = allCells[state.GetIndexFromPos(mycell.Row + Math.floor(action / 3) - 1, mycell.Col + (action % 3) - 1)].Owner
                    if (owner == otherplayer) {
                        points += 10;
                    }
                    else if (owner == this.threadID) {
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
            if (cellTotal - this.previousStats.myTotal >= 0) {
                points += 10;
            }
            else {
                points -= 10;
            }
            if (ownedCells.length - this.previousStats.myCellCount >= 0) {
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
            brain.backward(points);// + 50 * deltaCells);

            this.previousStats.myCellCount = ownedCells.length;
            this.previousStats.opCellCount = opCells.length;
            this.previousStats.myTotal = cellTotal;
            this.previousStats.opTotal = opTotal;

            brain.epsilon_test_time = 0.0; // don't make any random choices, ever
            brain.learning = true;

            var action = brain.forward(inputArray); // get optimal action from learned policy

            var foo = this.decodeAction(action, mycell, state);
            if (foo != null) {
                result.push(foo);
            }
            (<HTMLInputElement>document.getElementById("index")).innerHTML = (mycell.Row * state.dimension + mycell.Col).toString() + ":" + mycell.Row + "," + mycell.Col;
            //(<HTMLInputElement>document.getElementById("length")).innerHTML = ownedCells.length + "," + opCells.length;
            //(<HTMLInputElement>document.getElementById("total")).innerHTML = cellTotal + "," + opTotal;
            //console.log(surroundingCells);

        });
        var json = brain.value_net.toJSON();
        (<HTMLInputElement>document.getElementById("jsonBox")).value = JSON.stringify(json);
        brain.visSelf((<HTMLInputElement>document.getElementById("learnStats")));
        return result;
    }


    public Surrounding(state: GameState, row: number, col: number): number[] {
        var result: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
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
    }

    public cellsToNumberArray(cells: Cell[]): number[] {
        var numbers = [];

        cells.forEach((cell) => {
            numbers.push(cell.Value / 255);
        });
        return numbers;

    }

    public sigmoid(t: number): number {
        return 1 / (1 + Math.pow(Math.E, -t));
    }

    public decodeAction(action: number, cell: Cell, state: GameState): ThreadAction {
        var divider = 1.2;
        switch (action) {
            case 0: {   //LT
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row - 1) * state.dimension + (cell.Col - 1);
                if ((cell.Row - 1) < 0 || (cell.Col - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 1: {   //MT
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row - 1) * state.dimension + (cell.Col);
                if ((cell.Row - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 2: {   //RT
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row - 1) * state.dimension + (cell.Col + 1);
                if ((cell.Row - 1) < 0 || (cell.Col + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 3: {   //LM
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row) * state.dimension + (cell.Col - 1);
                if ((cell.Col - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 4: {   //Do nothing
                return null;
            }
            case 5: {   //RM
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row) * state.dimension + (cell.Col + 1);
                if ((cell.Col + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 6: {   //LB
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row + 1) * state.dimension + (cell.Col - 1);
                if ((cell.Row + 1) >= state.dimension || (cell.Col - 1) < 0 || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 7: {   //MB
                var cellIndex = cell.Row * state.dimension + cell.Col;
                var destIndex = (cell.Row + 1) * state.dimension + (cell.Col);
                if ((cell.Row + 1) >= state.dimension || cell.Value < 2) {
                    return null;
                }
                return new ThreadAction(this.threadID, cellIndex, destIndex, Math.floor(cell.Value / divider));
            }
            case 8: {   //RB
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
    }
}
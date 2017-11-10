using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using SharedMemLib;
using BrainNet.NeuralFramework;
using System.Collections;

namespace ThreadTryout
{
    class Program
    {
        static Random rnd = new Random(DateTime.Now.Millisecond);

        static void Main(string[] args)
        {

            Gate temp = new Gate();
            //int i = 0;
            //for (i = 0; i < 200000; i++){
            //    if (i % 4 == 0)
            //    {
            //        temp.Train(0, 0, 0);
            //    }
            //    else if(i % 3 == 0)
            //    {
            //        temp.Train(0, 1, 1);
            //    }
            //    else if (i % 2 == 0)
            //    {
            //        temp.Train(1, 0, 1);
            //    }
            //    else
            //    {
            //        temp.Train(1, 1, 1);
            //    }
            //}

            //Console.WriteLine(temp.Run(0, 0));
            //Console.WriteLine(temp.Run(0, 1));
            //Console.WriteLine(temp.Run(1, 0));
            //Console.WriteLine(temp.Run(1, 1));

            int i;
            for(i = 0; i < 20000; i++)
            {
                Gate.generateRoster();

            }

            Console.ReadKey();
            ////First line contains integers of [Dimension] [Your ThreadID 1 or 2] [  
            //var inputs = Console.ReadLine().Split(' ');

            //var Dimension = int.Parse(inputs[0]);
            //var ThreadID = int.Parse(inputs[1]);

            //while (true)
            //{
            //    //Every round, a number of lines with some integer values are given. 
            //    // dimension number of lines
            //    // dimension number of values 
            //    //Representing the memory cell values.
            //    //Positive values are for ThreadID 1
            //    //Negative values are for ThreadID 2

            //    GameState state = new GameState(Dimension);
            //    for (int i = 0; i < Dimension; i++)
            //    {
            //        var line = Console.ReadLine();
            //        state.SetCellValues(i, line);
            //    }

            //    //stupid random engine..
            //    var myCells = state.CellsOfThread(ThreadID).Where(c => c.Value > 1);
            //    foreach (var mycell in myCells)
            //    {
            //        if(mycell.Value >= 2)
            //        {
            //            var col = mycell.Col;
            //            var row = mycell.Row;
            //            var dest = myCells.FirstOrDefault(x => (col == x.Col + 2 || col == x.Col - 2) && row == x.Row);
            //            var trans = mycell.Value - 1;

            //            int sourIndex = mycell.Row * Dimension + mycell.Col;
            //            int destIndex = dest.Row * Dimension + dest.Col;
            //            Console.WriteLine(sourIndex + " " + destIndex + " " + trans);
            //        }

            //        //if (rnd.NextDouble() > 0.8)
            //        //{
            //        //    //get surrounding cells.
            //        //    var surroundingCells = state.GetCellsAround(mycell.Row, mycell.Col).ToList();

            //        //    //pick random destination cell.
            //        //    var destCell = surroundingCells[rnd.Next(surroundingCells.Count)];

            //        //    //pick random value to transfer
            //        //    var transferValue = rnd.Next(1, mycell.Value - 1);

            //        //    //Send action 
            //        //    int sourIndex = mycell.Row * Dimension + mycell.Col;
            //        //    int destIndex = destCell.Row * Dimension + destCell.Col;
            //        //    Console.WriteLine(sourIndex + " " + destIndex + " " + transferValue);
            //        //}
            //    }

            //    //
            //    Console.WriteLine();
            //}
        }
    }

    public class Gate
    {
        private INeuralNetwork Network { get; set; }

        public Gate()
        {
            BackPropNetworkFactory factory = new BackPropNetworkFactory();

            ArrayList layers = new ArrayList();
            layers.Add(16);
            layers.Add(16);
            layers.Add(16);
            layers.Add(10);

            Network = factory.CreateNetwork(layers);
        }

        public void Train(
            //inputs
            int LT,
            int MT,
            int RT,
            int LM,
            int center,
            int RM,
            int LB,
            int MB,
            int RB,
            //position of current cell
            int centerX,
            int centerY,
            //is the cell owned by player or opponement
            int cellOwned,
            //how far in the game are you
            int totalCells,
            int totalPoints,
            //how far is the opponement
            int totalCellsOp,
            int totalPointsOp,

            //ouputs
            double LTout,
            double MTout,
            double RTout,
            double LMout,
            double RMout,
            double LBout,
            double MBout,
            double RBout,
            double DoNothing,
            double movePoints
        )
        {
            ArrayList list = new ArrayList();
            int[] intList = { 1, 2, 3 };
            list.Add(intList);

            TrainingData td = new TrainingData();
        }
        //public void Train( int input1, int input2, double output)
        //{
        //    TrainingData td = new TrainingData();
        //    td.Inputs.Add(input1);
        //    td.Inputs.Add(input2);
        //    td.Outputs.Add(output);
        //    Network.TrainNetwork(td);
        //}

        public object Run(int input1, int input2)
        {
            ArrayList inputs = new ArrayList();
            inputs.Add(input1);
            inputs.Add(input2);

            ArrayList outputs = Network.RunNetwork(inputs);
            return outputs[0];
        }

        public static int[] generateRoster()
        {
            Random rnd = new Random();
            int[] Roster = { };
            int i;
            for(i = 0; i < 9; i++)
            {
                if (i == 4)
                {
                    Roster[i] = rnd.Next(1, 255);
                }
                else
                {
                    Roster[i] = rnd.Next(-255, 255);
                }
            }
            return Roster;
        }
    }
}

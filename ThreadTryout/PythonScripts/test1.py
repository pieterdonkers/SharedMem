#turn of avx warning
import os
os.environ['TF_CPP_MIN_LOG_LEVEL']='2'

#import tensorflow
import tensorflow as tf

#test 1
node1 = tf.constant(3.0,dtype=tf.float32)
node2 = tf.constant(4.0)
print(node1,node2)

#test 2
sess = tf.Session()
print(sess.run([node1,node2]))

#test 3
node3 = tf.add(node1,node2)
print("node3:",node3)
print("sess",sess.run(node3))

#test 4
a = tf.placeholder(tf.float32)
b = tf.placeholder(tf.float32)
adder_node = a + b

print(sess.run(adder_node,{a:3,b:4.5}))
print(sess.run(adder_node,{a:[1,3],b:[2,4]}))

add_and_triple = adder_node * 3.
print(sess.run(add_and_triple,{a:3,b:4.5}))

#test 4
W = tf.Variable([.3],dtype=tf.float32)
B = tf.Variable([-.3],dtype=tf.float32)
X = tf.placeholder(tf.float32)
linear_model = W* X + B

#print(sess.run(linear_model,{X:[1,2,3,4]}))  niet geinit dus werkt niet hier en crasht

#initialize variables. this is not done standardly like the constants
init = tf.global_variables_initializer()
sess.run(init)

#wel geinit dus werkt wel
print(sess.run(linear_model,{X:[1,2,3,4]}))

#test 5
Y = tf.placeholder(tf.float32)
squared_deltas = tf.square(linear_model - Y)
loss = tf.reduce_sum(squared_deltas)
print(sess.run(loss,{X:[1,2,3,4],Y:[0,-1,-2,-3]}))

#test 6
fixW = tf.assign(W,[-1.])
fixB = tf.assign(B,[1.])
sess.run([fixW,fixB])
print(sess.run(loss,{X:[1,2,3,4],Y:[0,-1,-2,-3]}))



#write log to visualize nodes using tensorboard
writer = tf.summary.FileWriter("logs/", graph=sess.graph)
#open tensorboard server using cmd -> tensorboard --logdir=run1:logs/ --port 6006
#go to localhost:6006

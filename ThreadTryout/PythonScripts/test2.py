#turn of avx warning
import os
os.environ['TF_CPP_MIN_LOG_LEVEL']='2'

#import tensorflow
import tensorflow as tf
sess = tf.Session()
#test 1
W = tf.Variable([.3],dtype=tf.float32)
B = tf.Variable([-.3],dtype=tf.float32)
X = tf.placeholder(tf.float32)
linear_model = W* X + B

init = tf.global_variables_initializer()
sess.run(init)
print(sess.run(linear_model,{X:[1,2,3,4]}))

Y = tf.placeholder(tf.float32)
squared_deltas = tf.square(linear_model - Y)
loss = tf.reduce_sum(squared_deltas)
print(sess.run(loss,{X:[1,2,3,4],Y:[0,-1,-2,-3]}))

fixW = tf.assign(W,[-1.])
fixB = tf.assign(B,[1.])
sess.run([fixW,fixB])
print(sess.run(loss,{X:[1,2,3,4],Y:[0,-1,-2,-3]}))

optimizer = tf.train.GradientDescentOptimizer(0.01)
train = optimizer.minimize(loss)

sess.run(init)
for i in range(1000):
	sess.run(train,{X:[1,2,3,4],Y:[0,-1,-2,-3]})

print(sess.run([W,B]))

#write log to visualize nodes using tensorboard
writer = tf.summary.FileWriter("logs/", graph=sess.graph)
#open tensorboard server using cmd -> tensorboard --logdir=run1:logs/ --port 6006
#go to localhost:6006

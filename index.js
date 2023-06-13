const express = require('express')
const cors = require('cors')
require('dotenv').config()
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000



app.use(cors())
app.use(express.json())
const stripe = require("stripe")(process.env.SK_KEY)

// Function to Verify The JWT
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    // bearer token
    const token = authorization.split(' ')[1]

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res
                .status(401)
                .send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded
        next()
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gexkyvp.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        //DB Collections
        const usersCollection = client.db('fab').collection('users')
        const classesCollection = client.db('fab').collection('classes')
        const selectedCollection = client.db('fab').collection('selected')
        const paymentsCollection = client.db('fab').collection('payments')

        //Creating jwt
        app.post('/jwt', (req, res) => {
            try {
                const user = req.body
                const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                    expiresIn: '1h',
                })

                res.send({ token })
            } catch (error) {
                res.send(error)
            }
        })


        //getting payments information for specific user
        app.get('/payments/:email', verifyJWT, async (req, res) => {
            try {
                const email = req.params.email;

                if (req.decoded.email !== email) {
                    return res.status(403).send({ err: true, message: 'Forbidden ACCESS' })
                }

                const query = { email: email };
                const result = await paymentsCollection.find(query).sort({ date: -1 }).toArray();
                res.send(result)
            } catch (error) {
                res.send(error)
            }
        })




        // adding to server for payment
        app.post("/payments", async (req, res) => {
            try {
                const payment = req.body;
                const insertedResult = await paymentsCollection.insertOne(payment);

                const query = { classId: payment.classId, studentEmail: payment.email };
                const deletedResult = await selectedCollection.deleteOne(query)
                res.send({ insertedResult, deletedResult })
            } catch (error) {
                res.send(error)
            }
        })



        // line 42-65 selected classes API

        // getting classes data form server which student selected
        app.get("/selected", async (req, res) => {
            try {
                const result = await selectedCollection.find().toArray();
                res.send(result);
            } catch (error) {
                res.send(error)
            }
        })

        //getting selected class by ID
        app.get('/selected/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) }
                const result = await selectedCollection.findOne(query)
                res.send(result)
            } catch (error) {
                res.send(error)
            }
        })

        // getting selected CLasses with email student dashboard
        app.get('/selected/user/:email', verifyJWT, async (req, res) => {
            try {
                const email = req.params.email;

                if (req.decoded.email !== email) {
                    return res.status(403).send({ err: true, message: 'Forbidden ACCESS' })
                }
                const query = { studentEmail: email };
                const result = await selectedCollection.find(query).toArray();
                res.send(result)
            } catch (error) {
                res.send(error)
            }
        })


        // deleting classes data form server which student selected
        app.delete("/selected/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const result = await selectedCollection.deleteOne(query);
                res.send(result);
            } catch (error) {
                res.send(error)
            }
        })


        // posting classes data to server which student selected
        app.post('/selected', async (req, res) => {
            try {
                const data = req.body;
                const query = { className: data.className, studentEmail: data.studentEmail }
                const existingClass = await selectedCollection.findOne(query);

                if (existingClass) {
                    return res.send({ message: 'Class already exists' })
                }
                else {
                    const result = await selectedCollection.insertOne(data)
                    res.send(result)
                }
            } catch (error) {
                res.send(error)
            }
        })


        // checking isInstructor
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            try {
                const email = req.params.email;

                if (req.decoded.email !== email) {
                    return res.send({ instructor: false })
                }

                const query = { email: email };
                const user = await usersCollection.findOne(query);
                const result = { instructor: user?.role === 'instructor' }
                res.send(result)
            } catch (error) {
                res.send(error)
            }
        })


        // checking isStudent
        app.get('/users/student/:email', verifyJWT, async (req, res) => {
            try {
                const email = req.params.email;

                if (req.decoded.email !== email) {
                    return res.send({ student: false })
                }

                const query = { email: email };
                const user = await usersCollection.findOne(query);
                const result = { student: user?.role === 'student' }
                res.send(result)
            } catch (error) {
                res.send(error)
            }
        })


        // checking isAdmin a
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            try {
                const email = req.params.email;

                if (req.decoded.email !== email) {
                    return res.send({ admin: false })
                }

                const query = { email: email };
                const user = await usersCollection.findOne(query);
                const result = { admin: user?.role === 'admin' }
                res.send(result)
            } catch (error) {
                res.send(error)
            }
        })


        // getting all the instructors form server
        app.get('/users/instructor', async (req, res) => {
            try {
                const query = { role: 'instructor' }
                const result = await usersCollection.find(query).toArray()
                res.send(result)
            } catch (error) {
                res.send(error)
            }
        })


        // getting all the users form server also verified JWT
        app.get('/users/allUsers', verifyJWT, async (req, res) => {
            try {
                const result = await usersCollection.find().toArray();
                res.send(result)
            } catch (error) {
                res.send(error)
            }
        })


        // saving users to DB
        app.put('/users/:email', async (req, res) => {
            try {
                const user = req.body;
                const query = { email: user.email }
                const existingUser = await usersCollection.findOne(query);

                if (existingUser) {
                    return res.send({ message: 'user already exists' })
                }

                const result = await usersCollection.insertOne(user);
                res.send(result);
            } catch (error) {
                res.send(error)
            }
        })

        // Making User Admin
        app.patch('/users/admin/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const filter = { _id: new ObjectId(id) };
                const updateDoc = {
                    $set: {
                        role: 'admin'
                    },
                };

                const result = await usersCollection.updateOne(filter, updateDoc);
                res.send(result);
            } catch (error) {
                res.send(error)
            }
        })

        // making user instructor
        app.patch('/users/instructor/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const filter = { _id: new ObjectId(id) };
                const updateDoc = {
                    $set: {
                        role: 'instructor'
                    },
                };

                const result = await usersCollection.updateOne(filter, updateDoc);
                res.send(result);
            } catch (error) {
                res.send(error)
            }
        })


        // getting all the classes 
        app.get('/classes', async (req, res) => {
            try {
                const result = await classesCollection.find().sort({ enrolled: -1 }).toArray()
                res.send(result)
            } catch (error) {
                res.send(error)
            }
        })

        // getting specific classes for email
        app.get('/classes/:email', verifyJWT, async (req, res) => {
            try {
                const email = req.params.email;

                if (req.decoded.email !== email) {
                    return res.send({ err: true, message: 'Forbidden ACCESS' })
                }
                const query = { instructorEmail: email }
                const result = await classesCollection.find(query).toArray()
                res.send(result)
            } catch (error) {
                res.send(error)
            }
        })

        //getting Approved Classes
        app.get('/approved', async (req, res) => {
            try {
                const query = { status: 'approved' }
                const result = await classesCollection.find(query).toArray()
                res.send(result)
            } catch (error) {
                res.send(error)
            }
        })

        // posting classes from instructors
        app.post('/classes', async (req, res) => {
            try {
                const data = req.body;
                const result = await classesCollection.insertOne(data)
                res.send(result)
            } catch (error) {
                res.send(error)
            }
        })


        // updating a specific classes
        app.put('/classes/update/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const body = req.body;
                const updatedClass = {
                    $set: {
                        price: body.price,
                        seats: body.seats
                    }
                }
                const result = await classesCollection.updateOne(query, updatedClass);
                res.send(result)
            } catch (error) {
                res.send(error)
            }
        })

        //when student decides to pay , deceasing seats and increasing enrolled
        app.put('/classes/enrolled/:id', async (req, res) => {
            try {
                const id = req.params.id;
                classesCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $inc: { seats: -1, enrolled: 1 } })
                    .then(() => {
                        res.send('Seats decremented successfully');
                    })
                    .catch((err) => {
                        console.error('Failed to decrement seats:', err);
                        res.status(500).send('An error occurred');
                    });

            } catch (error) {
                res.send(error)
            }
        })

        // updating the status approved
        app.patch('/classes/approve/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) }
                const updateDoc = {
                    $set: {
                        status: 'approved'
                    },
                };
                const result = await classesCollection.updateOne(query, updateDoc);
                res.send(result)
            } catch (error) {
                res.send(error)
            }
        })

        // updating the status denied
        app.patch('/classes/deny/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) }
                const updateDoc = {
                    $set: {
                        status: 'denied'
                    },
                };
                const result = await classesCollection.updateOne(query, updateDoc);
                res.send(result)
            } catch (error) {
                res.send(error)
            }
        })

        app.put('/classes/feedback/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const feedback = req.body


                const query = { _id: new ObjectId(id) }
                const updateDoc = {
                    $set: {
                        feedback: feedback.feedback
                    },
                };
                const result = await classesCollection.updateOne(query, updateDoc)
                res.send(result)
            } catch (error) {
                res.send(error)
            }
        })


        //[payments]
        app.post("/create-payment-intent", async (req, res) => {
            try {
                const { price } = req.body;
                const amount = price * 100;
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: "usd",
                    payment_method_types: ['card'],
                });

                res.send({
                    clientSecret: paymentIntent.client_secret,
                });
            } catch (error) {
                res.send(error)
            }
        });




        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})

const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");



let client = null;
let coll = null;
let coll2 = null;
let col3 = null;
let col4 = null;
let user_id = null;
const app = express();

app.use(express.json());
app.use(cors());


async function MongoConnect() {
  client = await MongoClient.connect(
    'mongodb+srv://root:root@praveenfirstcluster.pmszko2.mongodb.net/?retryWrites=true&w=majority'
  );
  coll = client.db('LevelUp').collection('User');
  coll2 = client.db('LevelUp').collection('sequences');
  col3 = client.db('LevelUp').collection('ExerciseList');
  col4 = client.db('LevelUp').collection('Level');
}


app.use(async (req, res, next) => {
  if (!client) {
    await MongoConnect();
  }
  next();
});


async function getNextSequenceValue(sequenceName) {
  const sequenceDocument = coll2.findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { sequence_value: 1 } },
    { returnDocument: 'after', upsert: true }
  );

  const cursor = coll2.aggregate([
    {
      '$match': {
        '_id': sequenceName,
      }
    }
  ]);
  const result = await cursor.toArray();
  return result[0].sequence_value;
}




app.get("/", async (req, res) => {
  const cursor = coll.aggregate([
    {
      '$match': {
        'name': "praveen",
        'password': "praveen@123"
      }
    }
  ]);
  const result = await cursor.toArray();
  res.send(result)
});

app.post("/ulogin", async (req, res) => {
  const name = req.body.username;
  const pass = req.body.password;
  console.log(req.body);

  // Check if the user exists
  const cursor = coll.aggregate([
    {
      '$match': {
        'name': name,
        'password': pass
      }
    }
  ]);
  const result = await cursor.toArray();
  if (result.length === 0) {
    res.send("no"); // User not found
    return;
  }

  user_id = result[0]._id;

  // const lastInsertedDoc = await col3.findOne(
  //   { user_id: user_id },
  //   { sort: { time: -1 } }
  // );

  // if (!lastInsertedDoc) {
  //   console.log("No previous record found");
  //   res.send("yes");
  //   return;
  // }

  // // Calculate the time difference in minutes
  // const timeDifferenceMs = Date.now() - lastInsertedDoc.time.getTime();
  // const timeDifferenceMin = Math.floor(timeDifferenceMs / (1000 * 60));

  // // Deduct based on the time difference only if the level is greater than 0
  // if (lastInsertedDoc.level > 0) {
  //   const deductionAmount = timeDifferenceMin * -0.05;
  //   console.log("Deducting level:", deductionAmount);

  //   // Deduct the level
  //   const levelDocument = await col4.findOneAndUpdate(
  //     { _id: user_id },
  //     { $inc: { level: deductionAmount } },
  //     { returnDocument: 'after', upsert: true }
  //   );

  //   // Insert a record for the deduction
  //   if (deductionAmount !== 0) {
  //     await col3.insertOne({
  //       user_id: user_id,
  //       time: currentTime
  //     });
  //   }

    // await col3.insertOne({
    //   user_id: user_id,
    //   time: new Date()
    // });
  // }

  res.send("yes");
});

app.get("/deduction", async (req, res) => {
 
  const lastInsertedDoc1 = await col3.findOne(
    { user_id: user_id },
    { sort: { time: -1 } }
  );

  if (!lastInsertedDoc1) {
    res.send("yes");
    return;
  }

  // Calculate the time difference in minutes
  const timeDifferenceMs = Date.now() - lastInsertedDoc1.time.getTime();
  const timeDifferenceMin = Math.floor(timeDifferenceMs / (1000 * 60 * 60 * 24));

  const lastInsertedDoc = await col4.findOne(
    { _id: user_id }
  );
  
 
  if (lastInsertedDoc.level >= 0.5) {
    
    const deductionAmount = timeDifferenceMin * -0.5;
    console.log("Deducting level:", deductionAmount);

    // Deduct the level
    const levelDocument = await col4.findOneAndUpdate(
      { _id: user_id },
      { $inc: { level: deductionAmount } },
      { returnDocument: 'after', upsert: true }
    );

    // Insert a record for the deduction
    if (deductionAmount !== 0) {
      await col3.insertOne({
        user_id: user_id,
        time: Date.now()
      });
    }
  }
  
})



app.post("/userRegister", async (req, res) => {
  const user = req.body;
  const nextValue = await getNextSequenceValue("user");
  console.log(nextValue)
  await coll.insertOne({
    "_id": nextValue,
    "name": user.name,
    "email": user.email,
    "phone": user.pno,
    "password": user.pass
  });

  const cursor = coll.aggregate([
    {
      '$match': {
        'name': user.name,
        'password': user.pass
      }
    }
  ]);
  const result = await cursor.toArray();
  user_id = result[0]._id
  await col4.insertOne({
    "_id": user_id,
    "level": 0
  });
  res.send("yes");
});

app.post("/ExcerciseList", async (req, res) => {
  const user = req.body;

  const nextValue = await getNextSequenceValue("exercise");

  console.log(nextValue)

  await col3.insertOne({
    "pushUps": user.pushUp,
    "squats": user.squats,
    "sitUps": user.sitUp,
    "time": new Date(),
    "user_id": user_id
  });

  let total = (((parseInt(user.pushUp) + parseInt(user.squats) + parseInt(user.sitUp)) / 3) / 50000) * 100;
  console.log(total)
  const levelDocument = col4.findOneAndUpdate(
    { _id: user_id },
    { $inc: { level: total } },
    { returnDocument: 'after', upsert: true }
  );
  res.send("yes");

});


app.get("/getLevel", async (req, res) => {
  try {
    if (!user_id) {
      return res.status(400).send("User ID is missing");
    }
    const cursor = col4.aggregate([
      { $match: { _id: user_id } }
    ]);
    const result = await cursor.toArray();
    if (result.length === 0) {
      return res.status(404).send("User level not found");
    }

    res.send({ level: Math.floor(result[0].level) });
  } catch (error) {
    console.error("Error fetching user level:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(8080, () => {
  console.log("App is listening on port 8080");
});


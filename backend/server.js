import express from 'express';
import Database from 'better-sqlite3';
import cors from 'cors';

const app = express();

app.use(express.json());
app.use(cors({
  "origin": "*",
  "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
  "preflightContinue": false,
  "optionsSuccessStatus": 204
}));

app.get('/', (req, res) => {
  return res.status(200).send({'message': 'SHIPTIVITY API. Read documentation to see API docs'});
});

// We are keeping one connection alive for the rest of the life application for simplicity
const db = new Database('./clients.db');

// Don't forget to close connection when server gets terminated
const closeDb = () => db.close();
process.on('SIGTERM', closeDb);
process.on('SIGINT', closeDb);

/**
 * Validate id input
 * @param {any} id
 */
const validateId = (id) => {
  if (Number.isNaN(id)) {
    return {
      valid: false,
      messageObj: {
      'message': 'Invalid id provided.',
      'long_message': 'Id can only be integer.',
      },
    };
  }
  const client = db.prepare('select * from clients where id = ? limit 1').get(id);
  if (!client) {
    return {
      valid: false,
      messageObj: {
      'message': 'Invalid id provided.',
      'long_message': 'Cannot find client with that id.',
      },
    };
  }
  return {
    valid: true,
  };
}

/**
 * Validate priority input
 * @param {any} priority
 */
const validatePriority = (priority) => {
  if (Number.isNaN(priority)) {
    return {
      valid: false,
      messageObj: {
      'message': 'Invalid priority provided.',
      'long_message': 'Priority can only be positive integer.',
      },
    };
  }
  return {
    valid: true,
  }
}

/**
 * Get all of the clients. Optional filter 'status'
 * GET /api/v1/clients?status={status} - list all clients, optional parameter status: 'backlog' | 'in-progress' | 'complete'
 */
app.get('/api/v1/clients', (req, res) => {
  const status = req.query.status;
  if (status) {
    // status can only be either 'backlog' | 'in-progress' | 'complete'
    if (status !== 'backlog' && status !== 'in-progress' && status !== 'complete') {
      return res.status(400).send({
        'message': 'Invalid status provided.',
        'long_message': 'Status can only be one of the following: [backlog | in-progress | complete].',
      });
    }
    const clients = db.prepare('select * from clients where status = ?').all(status);
    return res.status(200).send(clients);
  }
  const statement = db.prepare('select * from clients');
  const clients = statement.all();
  return res.status(200).send(clients);
});

/**
 * Get a client based on the id provided.
 * GET /api/v1/clients/{client_id} - get client by id
 */
app.get('/api/v1/clients/:id', (req, res) => {
  const id = parseInt(req.params.id , 10);
  const { valid, messageObj } = validateId(id);
  if (!valid) {
    res.status(400).send(messageObj);
  }
  return res.status(200).send(db.prepare('select * from clients where id = ?').get(id));
});

/**
 * Update client information based on the parameters provided.
 * When status is provided, the client status will be changed
 * When priority is provided, the client priority will be changed with the rest of the clients accordingly
 * Note that priority = 1 means it has the highest priority (should be on top of the swimlane).
 * No client on the same status should not have the same priority.
 * This API should return list of clients on success
 *
 * PUT /api/v1/clients/{client_id} - change the status of a client
 *    Data:
 *      status (optional): 'backlog' | 'in-progress' | 'complete',
 *      priority (optional): integer,
 *
 */

// NOTE: Didn't use this feature becuase the front-end is modifying the priority numbering of all applicable items in the from and to categories when a drag/drop operation is performed. (So more than one item needs to be updated each time an item moves due to the priority re-numbering.)
// app.put('/api/v1/clients/:id', (req, res) => {
//   const id = parseInt(req.params.id , 10);
//   const { valid, messageObj } = validateId(id);
//   if (!valid) {
//     res.status(400).send(messageObj);
//   }

//   let { status, priority } = req.body;
//   let clients = db.prepare('select * from clients').all();
//   const client = clients.find(client => client.id === id);

//   /* ---------- Update code below ----------*/


//   return res.status(200).send(clients);
// });

app.put('/api/v1/clients', (req, res) => {
  const fullList = req.body;

  // Another option is to delete the db and just re-enter all the data since we are updating almost all of the records at times:
  // db.prepare('DELETE FROM clients').run();

  // for (let j = 0; j < fullList.length; j++){
  //   const { id, name, description, status, priority } = fullList[j];

  //   db.prepare('INSERT INTO clients (id, name, description, status, priority) VALUES (?, ?, ?, ?, ?)').run(id, name, description, status, priority);
  // }
  // However, the below performs the updates with the UPDATE syntax:

  let oldData = db.prepare('select * from clients').all();

  for (let j = 0; j < fullList.length; j++){
    let { id, status, priority } = fullList[j];
    for (let k = 0; k < oldData.length; k++){
      let { id: oldId, status: oldStatus, priority: oldPriority } = oldData[k];

      if(id === oldId && status !== oldStatus){
        db.prepare('UPDATE clients set status = ? WHERE id = ?').run(status, id);
      }
      if(id === oldId && priority !== oldPriority){
        db.prepare('UPDATE clients set priority = ? WHERE id = ?').run(priority, id);
      }
    }
  }
  return res.status(200).send(db.prepare('select * from clients').all());
});

app.listen(3001);
console.log('app running on port ', 3001);
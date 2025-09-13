db = db.getSiblingDB('tasktracker');

// Create application user
db.createUser({
  user: 'tasktracker_user',
  pwd: 'secure_password_here',
  roles: [
    {
      role: 'readWrite',
      db: 'tasktracker'
    }
  ]
});

// Create indexes for better performance
db.tasks.createIndex({ "createdBy": 1, "status": 1 });
db.tasks.createIndex({ "assignee": 1, "status": 1 });
db.tasks.createIndex({ "dueDate": 1, "status": 1 });
db.tasks.createIndex({ "priority": 1, "status": 1 });
db.tasks.createIndex({ 
  "title": "text", 
  "description": "text" 
});

db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "username": 1 }, { unique: true });

print('Database initialized successfully');
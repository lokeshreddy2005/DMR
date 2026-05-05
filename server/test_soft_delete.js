const axios = require('axios');
const API_URL = 'http://localhost:5000';
const mongoose = require('mongoose');

async function test() {
  try {
    // 1. We need to create a test user or just use mongo directly to verify the schema since login requires password, but wait we can just register a user
    const userRes = await axios.post(`${API_URL}/api/auth/register`, {
      name: 'Test Trash User',
      email: 'trash_test@example.com',
      password: 'password123'
    });
    
    const token = userRes.data.token;
    console.log('User registered');

    // Wait we can't upload directly without a file, let's just create a document directly in mongo for testing
    // Or we can create a simple file and upload it
  } catch (err) {
    if (err.response?.data?.error === 'User already exists') {
        const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
            email: 'trash_test@example.com',
            password: 'password123'
        });
        console.log('User logged in');
        return loginRes.data.token;
    }
    console.error(err);
  }
}

test();

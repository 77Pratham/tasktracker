const { authenticate, authorize } = require('../../middleware/auth');
const { createTestUser, generateAuthToken } = require('../helpers/testHelpers');

describe('Authentication Middleware', () => {
  describe('authenticate', () => {
    let user, token, req, res, next;

    beforeEach(async () => {
      user = await createTestUser();
      token = generateAuthToken(user);

      req = {
        headers: {},
        user: null
      };

      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      next = jest.fn();
    });

    it('should authenticate user with valid token', async () => {
      req.headers.authorization = `Bearer ${token}`;

      await authenticate(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(user._id.toString());
      expect(req.user.username).toBe(user.username);
      expect(next).toHaveBeenCalled();
    });

    it('should fail without token', async () => {
      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access token is required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should fail with invalid token', async () => {
      req.headers.authorization = 'Bearer invalidtoken';

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should fail for inactive user', async () => {
      user.isActive = false;
      await user.save();

      req.headers.authorization = `Bearer ${token}`;

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Account has been deactivated'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    let req, res, next;

    beforeEach(() => {
      req = { user: null };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    it('should authorize user with correct role', () => {
      req.user = { role: 'admin' };
      const middleware = authorize(['admin', 'manager']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should fail authorization for wrong role', () => {
      req.user = { role: 'user' };
      const middleware = authorize(['admin', 'manager']);

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should fail without authenticated user', () => {
      const middleware = authorize(['admin']);

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
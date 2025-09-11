import { User } from '../db/schema/users';

declare global {
  namespace Express {
    interface Request {
      user?: User | any;
      logout: (callback: (err: any) => void) => void;
      logIn: (user: any, callback: (err: any) => void) => void;
      isAuthenticated: () => boolean;
    }
  }
}

export {};
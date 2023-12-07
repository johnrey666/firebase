import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Observable } from 'rxjs';
import { UserInfo  } from 'firebase/auth';
import { map, tap } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { User } from 'firebase/auth'; // Corrected import
import { getAuth, updateProfile } from "firebase/auth";
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { filter } from 'rxjs/operators';




@Injectable({
  providedIn: 'root'
})

export class AuthService {
  private _user$ = new BehaviorSubject<User | null>(null);
  user$ = this._user$.asObservable();

  constructor(private firebaseAuth: AngularFireAuth, private firestore: AngularFirestore) {     
    this.firebaseAuth.authState.pipe(
      map(user => user ? { ...user, email: user.email, providerData: user.providerData.filter(pd => pd !== null) as UserInfo[] } : null)
    ).subscribe(user => {
      console.log('Auth state changed:', user);
      this._user$.next(user);
    });
  }

  public getIdToken() {
    return this.firebaseAuth.idToken;
  }

  async login(email: string, password: string): Promise<User | null> {
    try {
      console.log('Logging in with email:', email);
      const credential = await this.firebaseAuth.signInWithEmailAndPassword(email, password);
      console.log('Credential:', credential);
  
      if (credential.user) {
        const user = {
          ...credential.user,
          providerData: credential.user.providerData.filter(pd => pd !== null) as UserInfo[]
        };
        this._user$.next(user);
        return user;
      }
      return null;
    } catch (error) {
      console.error('Error during login:', error);
      return null;
    }
  }
  
  public async updateUserData(user: User | null) {
    if (user) {
      const auth = getAuth();
      const userAuth = auth.currentUser;
      if (userAuth) {
        await updateProfile(userAuth, {
          photoURL: user.photoURL
        }).then(() => {
          console.log('Profile updated successfully');
          this._user$.next(user);
        }).catch((error) => {
          console.error('Error updating profile:', error);
        });
      }
    }
  }

  signUp(email: string, password: string) {
    return this.firebaseAuth.createUserWithEmailAndPassword(email, password).then((result) => {
      return this.firestore.collection('users').doc(result.user?.uid).set({
        email: result.user?.email,
        // Add any other user properties you need
      });
    });
  }

  async signOut() {
    await this.firebaseAuth.signOut();
    this._user$.next(null); // Add this line
  }

  getCurrentUser() {
    const auth = getAuth();
    return auth.currentUser;
  }

  getUserPhotoURL(uid: string): Promise<string> {
    const storage = getStorage();
    const photoRef = ref(storage, `${uid}`);
    return getDownloadURL(photoRef);
  }

  getUserByEmail(email: string): Observable<User> {
    return this.firestore.collection('users', ref => ref.where('email', '==', email))
      .valueChanges()
      .pipe(map(users => users[0] as User));
  }
  getUserAndPhotoByEmail(email: string): Observable<User> {
    return this.firestore.collection('users', ref => ref.where('email', '==', email))
      .valueChanges()
      .pipe(
        map(users => {
          console.log('Users:', users); // Add this line
          return users[0] as User;
        }),
        switchMap(user => {
          return from(this.getUserPhotoURL(user.uid)).pipe(
            map(photoURL => {
              console.log('Photo URL:', photoURL); // Add this line
              return { ...user, photoURL: photoURL };
            })
          );
        })
      );
  }

  getUserById(id: string): Observable<User> {
    return this.firestore.doc<User>(`users/${id}`).snapshotChanges().pipe(
      filter(snapshot => !!snapshot.payload.data()),
      map(snapshot => ({ uid: snapshot.payload.id, ...snapshot.payload.data() } as User))
    );
  }

  getUsers(): Observable<User[]> {
    return this.firestore.collection<User>('users').valueChanges().pipe(
      tap(users => console.log('Users from Firestore:', users))
    );
  }
}
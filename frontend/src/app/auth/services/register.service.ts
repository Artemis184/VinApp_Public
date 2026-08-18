import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';

/* ========================= */
/* INTERFACES */
/* ========================= */

export interface CreateUserEmailPayload {
  email: string;
  password: string;
}

export interface CompleteRegisterPayload {
  full_name: string;
  phone: string;
  address: string;
  reference?: string;
}

export interface CompleteRegisterResponse {
  message: string;
  data: {
    id: string;
    status: string;
  };
}

export interface UserResponse {
  message: string;
  data: {
    id: string;
    email: string;
    status: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class RegisterService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/users`;
  private readonly googleDeviceKey = 'GOOGLE_REGISTER_DEVICE_ID';

  /* ========================= */
  /* PASO 1 – CREAR USUARIO */
  /* ========================= */
  createUserWithEmail(
    payload: CreateUserEmailPayload,
  ): Observable<UserResponse> {
    return this.http.post<UserResponse>(
      `${this.apiUrl}/postuserwithemail`,
      payload,
    );
  }

  /* ========================= */
  /* PASO 2 – COMPLETAR DATOS */
  /* ========================= */
  completeRegister(
    userId: string,
    payload: CompleteRegisterPayload,
  ): Observable<CompleteRegisterResponse> {
    return this.http.patch<CompleteRegisterResponse>(
      `${this.apiUrl}/register/${userId}`,
      payload,
    );
  }

  /* ========================= */
  /* GOOGLE */
  /* ========================= */
  registerWithGoogle(id_token: string): Observable<UserResponse> {
    return this.http.post<UserResponse>(
      `${this.apiUrl}/postusergoogle`,
      {
        id_token,
        deviceId: this.getOrCreateDeviceId(),
      },
      { withCredentials: true },
    );
  }

  private getOrCreateDeviceId(): string {
    const existing = localStorage.getItem(this.googleDeviceKey);
    if (existing) {
      return existing;
    }

    const generated = crypto.randomUUID();
    localStorage.setItem(this.googleDeviceKey, generated);
    return generated;
  }
}

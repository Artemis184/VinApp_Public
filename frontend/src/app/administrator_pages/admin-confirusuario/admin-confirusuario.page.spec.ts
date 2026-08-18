import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminConfirusuarioPage } from './admin-confirusuario.page';

describe('AdminConfirusuarioPage', () => {
  let component: AdminConfirusuarioPage;
  let fixture: ComponentFixture<AdminConfirusuarioPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminConfirusuarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

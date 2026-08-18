import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminEditusuarioPage } from './admin-editusuario.page';

describe('AdminEditusuarioPage', () => {
  let component: AdminEditusuarioPage;
  let fixture: ComponentFixture<AdminEditusuarioPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminEditusuarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

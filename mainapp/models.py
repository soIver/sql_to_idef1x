from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from django.db import models
from django.contrib.auth.hashers import make_password, check_password

class UserManager(models.Manager):
    def normalize_email(self, email):
        return email.lower() if email else email

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)  # хэширует пароль
        user.save(using=self._db)
        return user

class User(models.Model):
    id = models.AutoField(primary_key=True)
    email = models.EmailField(unique=True, max_length=255)
    password_hash = models.CharField(max_length=255)

    objects = UserManager()

    def __str__(self):
        return self.email

    def set_password(self, raw_password):
        """Хэширует пароль и сохраняет его в password_hash."""
        try:
            validate_password(raw_password)
        except ValidationError as e:
            raise ValidationError({'password': e.messages})
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password):
        """Проверяет, совпадает ли raw_password с password_hash."""
        return check_password(raw_password, self.password_hash)

    class Meta:
        db_table = 'users'
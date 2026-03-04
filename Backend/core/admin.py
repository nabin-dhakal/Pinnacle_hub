from sqladmin import ModelView
from models.user import User

class UserAdmin(ModelView, model=User):
    column_list = [User.id, User.username, User.email, User.fullname, User.is_active, User.created_at]
    column_searchable_list = [User.username, User.email]
    column_sortable_list = [User.created_at, User.is_active]
    name = "User"
    name_plural = "Users"
    icon = "fa-solid fa-user"
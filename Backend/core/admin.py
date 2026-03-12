from sqladmin import ModelView
from models.user import User
from models.document import File

class UserAdmin(ModelView, model=User):
    column_list = [User.id, User.username, User.email, User.fullname, User.is_active, User.created_at]
    column_searchable_list = [User.username, User.email]
    column_sortable_list = [User.created_at, User.is_active]
    name = "User"
    name_plural = "Users"
    icon = "fa-solid fa-user"

class DocsAdmin(ModelView, model = File):
    column_list = [File.id, File.name, File.owner_id, File.type]
    column_details_list = [File.id, File.name, File.owner_id, File.type, File.content, File.version, File.created_at, File.updated_at,"permissions"]
    column_searchable_list = [File.name, File.type]
    column_sortable_list = [File.created_at]
    name = "File"
    name_plural = "Files"
    icon = "fa-regular fa-file"
    column_formatters = {
        "owner": lambda m, a: m.owner.username if m.owner else "",
        "permissions": lambda m, a: ", ".join([f"{p.user.username}:{p.permission.value}" for p in m.permissions])
    }
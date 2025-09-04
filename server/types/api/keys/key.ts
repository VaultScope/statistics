import Permissions from "./permissions";

export default interface Key {
    uuid: string,
    name: string,
    key: string,
    permissions: Permissions,
    createdAt: Date
}
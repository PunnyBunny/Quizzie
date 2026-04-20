import React, { useEffect, useState } from "react";
import { useHttpsCallable } from "react-firebase-hooks/functions";
import { functions } from "../lib/firebase.ts";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { Alert } from "../components/Alert";
import { AddUserIcon, CloseIcon, SearchIcon } from "../components/icons";

interface User {
  email?: string;
  isAdmin: boolean;
}

interface AdminGetUsersResponse {
  users: User[];
}

interface AdminCreateUserInput {
  email: string;
}

interface AdminCreateUserOutput {
  uid: string;
  email: string;
  resetLink: string;
}

interface AdminResetPasswordInput {
  email: string;
}

interface AdminResetPasswordOutput {
  email: string;
  resetLink: string;
}

interface AdminRemoveUserInput {
  email: string;
}

interface AdminRemoveUserOutput {
  email: string;
}

const INPUT_CLASSES =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 shadow-sm";

export default function AdminUserManagement() {
  const [getUsers, gettingUsers, getUsersError] = useHttpsCallable<{}, AdminGetUsersResponse>(
    functions,
    "api/admin/get-users",
  );
  const [createUser, creatingUser, createUserError] = useHttpsCallable<
    AdminCreateUserInput,
    AdminCreateUserOutput
  >(functions, "api/admin/create-user");
  const [resetPassword, resettingPassword] = useHttpsCallable<
    AdminResetPasswordInput,
    AdminResetPasswordOutput
  >(functions, "api/admin/reset-password");
  const [removeUser, removingUser] = useHttpsCallable<AdminRemoveUserInput, AdminRemoveUserOutput>(
    functions,
    "api/admin/remove-user",
  );

  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [formData, setFormData] = useState({ email: "" });
  const [createUserSuccess, setCreateUserSuccess] = useState(false);
  const [resetLinkPopup, setResetLinkPopup] = useState<{
    email: string;
    resetLink: string;
    title: string;
    message: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void getUsers().then((response) => {
      if (response?.data?.users) {
        setUsers(response.data.users);
      }
    });
  }, [getUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateUserSuccess(false);

    try {
      const result = await createUser({ email: formData.email });

      if (result?.data) {
        setResetLinkPopup({
          email: result.data.email,
          resetLink: result.data.resetLink,
          title: "User Created Successfully",
          message: `User ${result.data.email} has been created. Share the password reset link below with the user so they can set their password.`,
        });

        setFormData({ email: "" });
        setCreateUserSuccess(true);
        setTimeout(() => setCreateUserSuccess(false), 3000);

        const response = await getUsers();
        if (response?.data?.users) {
          setUsers(response.data.users);
        }
      }
    } catch (error) {
      console.error("Failed to create user:", error);
    }
  };

  const handleCopyLink = async () => {
    if (resetLinkPopup?.resetLink) {
      await navigator.clipboard.writeText(resetLinkPopup.resetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const closePopup = () => {
    setResetLinkPopup(null);
    setCopied(false);
  };

  const handleResetPassword = async (email: string) => {
    try {
      const result = await resetPassword({ email });
      if (result?.data) {
        setResetLinkPopup({
          email: result.data.email,
          resetLink: result.data.resetLink,
          title: "Password Reset Link Generated",
          message: `A password reset link has been generated for ${result.data.email}. Share this link with the user so they can reset their password.`,
        });
      }
    } catch (error) {
      console.error("Failed to reset password:", error);
    }
  };

  const handleRemoveUser = async (email: string) => {
    const confirmed = confirm(
      `Are you sure you want to remove ${email}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      const result = await removeUser({ email });
      if (result?.data) {
        confirm(`User ${result.data.email} has been successfully removed.`);

        const response = await getUsers();
        if (response?.data?.users) {
          setUsers(response.data.users);
        }
      }
    } catch (error) {
      console.error("Failed to remove user:", error);
    }
  };

  const filteredUsers = users.filter((user) =>
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="p-6">
      {resetLinkPopup && (
        <Modal onClose={closePopup} maxWidth="lg">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{resetLinkPopup.title}</h3>
            <button
              type="button"
              onClick={closePopup}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>

          <p className="text-gray-600 mb-4">{resetLinkPopup.message}</p>

          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password Reset Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={resetLinkPopup.resetLink}
                className="flex-1 text-sm bg-white border border-gray-300 rounded px-3 py-2 text-gray-700"
              />
              <Button variant={copied ? "success" : "primary"} onClick={handleCopyLink}>
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={closePopup}>
              Close
            </Button>
          </div>
        </Modal>
      )}

      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="User Management"
          subtitle="Manage platform users, roles, and permissions"
          backTo="/admin"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create User Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border shadow-sm p-6 sticky top-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AddUserIcon className="w-5 h-5 text-green-600" />
                Add New User
              </h3>

              <form className="space-y-4" onSubmit={handleCreateUser}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ email: e.target.value })}
                    className={INPUT_CLASSES}
                    placeholder="user@example.com"
                    required
                  />
                </div>

                {createUserError && (
                  <Alert kind="error">Error: {createUserError.message}</Alert>
                )}

                {createUserSuccess && <Alert kind="success">User created successfully!</Alert>}

                <Button
                  type="submit"
                  variant="success"
                  disabled={creatingUser}
                  className="w-full"
                >
                  {creatingUser ? "Creating..." : "Create User"}
                </Button>
              </form>
            </div>
          </div>

          {/* User List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">System Users</h3>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="absolute left-2.5 top-2 text-gray-400">
                    <SearchIcon />
                  </div>
                </div>
              </div>

              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">User</th>
                    <th className="px-6 py-3 font-medium">Role</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {gettingUsers && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        Loading users...
                      </td>
                    </tr>
                  )}
                  {getUsersError && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-red-600">
                        Error loading users: {getUsersError.message}
                      </td>
                    </tr>
                  )}
                  {!gettingUsers &&
                    !getUsersError &&
                    (filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          {users.length === 0 ? "No users found" : "No users match your search"}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user, index) => (
                        <tr key={index}>
                          <td className="px-6 py-3 font-medium text-gray-900">{user.email}</td>
                          <td className="px-6 py-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                user.isAdmin
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {user.isAdmin ? "Admin" : "User"}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          </td>
                          <td className="px-6 py-3 space-x-2">
                            {user.isAdmin ? (
                              "N/A"
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => user.email && handleResetPassword(user.email)}
                                  disabled={resettingPassword || !user.email}
                                >
                                  Reset Pwd
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => user.email && handleRemoveUser(user.email)}
                                  disabled={removingUser || !user.email}
                                >
                                  Remove
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

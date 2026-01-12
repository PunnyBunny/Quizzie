import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHttpsCallable } from "react-firebase-hooks/functions";
import { functions } from "../lib/firebase.ts";

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

function BackArrowIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className="w-6 h-6"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

export default function AdminUserManagement() {
  const navigate = useNavigate();
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
  const [formData, setFormData] = useState({
    email: "",
  });
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
      const result = await createUser({
        email: formData.email,
      });

      if (result?.data) {
        // Show popup with reset link
        setResetLinkPopup({
          email: result.data.email,
          resetLink: result.data.resetLink,
          title: "User Created Successfully",
          message: `User ${result.data.email} has been created. Share the password reset link below with the user so they can set their password.`,
        });

        // Clear form and refresh users list
        setFormData({ email: "" });
        setCreateUserSuccess(true);
        setTimeout(() => setCreateUserSuccess(false), 3000);

        // Refresh the users list
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
        // Show success message
        confirm(`User ${result.data.email} has been successfully removed.`);

        // Refresh the users list
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
      {/* ...existing code... */}

      {/* Reset Link Popup Modal */}
      {resetLinkPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{resetLinkPopup.title}</h3>
              <button onClick={closePopup} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
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
                <button
                  onClick={handleCopyLink}
                  className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                    copied ? "bg-green-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={closePopup}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <BackArrowIcon />
            </button>
            <div>
              <h1 className="text-3xl font-bold">User Management</h1>
              <p className="text-gray-600 mt-1">Manage platform users, roles, and permissions</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create User Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border shadow-sm p-6 sticky top-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  />
                </svg>
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
                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    placeholder="user@example.com"
                    required
                  />
                </div>

                {createUserError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
                    Error: {createUserError.message}
                  </div>
                )}

                {createUserSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-600">
                    User created successfully!
                  </div>
                )}

                <button
                  type="submit"
                  disabled={creatingUser}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingUser ? "Creating..." : "Create User"}
                </button>
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
                  <svg
                    className="w-4 h-4 text-gray-400 absolute left-2.5 top-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
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
                          <td className="px-6 py-4 font-medium text-gray-900">{user.email}</td>
                          <td className="px-6 py-4">
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
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          </td>
                          <td className="px-6 py-4 space-x-3">
                            {user.isAdmin ? (
                              "N/A"
                            ) : (
                              <div>
                                <button
                                  onClick={() => user.email && handleResetPassword(user.email)}
                                  disabled={resettingPassword || !user.email}
                                  className="text-blue-600 hover:text-blue-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Reset Pwd
                                </button>
                                <button
                                  onClick={() => user.email && handleRemoveUser(user.email)}
                                  disabled={removingUser || !user.email}
                                  className="text-red-600 hover:text-red-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Remove
                                </button>
                              </div>
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

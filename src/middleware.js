import { NextResponse } from 'next/server';

export async function middleware(request) {
    const { pathname } = request.nextUrl;

    const headers = new Headers(request.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', '*');

    // Handle OPTIONS requests for CORS preflight
    if (request.method === 'OPTIONS') {
        return NextResponse.json(null, { status: 200, headers });
    }

    // Allow specific paths without authentication
    if (allowedPaths.some(path => pathname.startsWith(path))) {
        return NextResponse.next({ request: { headers } });
    }

    // Handle API requests requiring Bearer token authorization
    if (pathname.startsWith('/api')) {
        const authorizationHeader = request.headers.get('authorization');
        if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
            return NextResponse.json({ status: 'Unauthorized' }, { status: 401, headers });
        }

        try {
            // Forward the authorization header to the /api/tokenverify endpoint
            const response = await fetch(`${request.nextUrl.origin}/api/tokenverify`, {
                method: 'GET',
                headers: { authorization: authorizationHeader },
            });
            if (response.status === 200) {
                return NextResponse.next({ request: { headers } });
            } else {
                return NextResponse.json({ status: 'Unauthorized' }, { status: 401 });
            }
        } catch (error) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    // Check authentication for UI routes
    if (!allowedPathsUI.some(path => pathname.startsWith(path))) {
        const token = request.cookies.get('token');
        if (!token) {
            // Prevent redirection loop by checking if user is already on the login page
            if (pathname !== '/login') {
                return NextResponse.redirect(new URL('/login', request.url));
            }
            return NextResponse.next();
        }

        try {
            // Verify the token by calling the /api/tokenverify endpoint
            const verifyResponse = await fetch(`${request.nextUrl.origin}/api/tokenverify`, {
                method: 'GET',
                headers: { authorization: `Bearer ${token.value}` },
            });
            const decoded = await verifyResponse.json();
            if (verifyResponse.status === 200) {
                // Redirect based on user type if not already on the respective dashboard
                if (decoded.type === 'Admin' && pathname !== '/admin/dashboard') {
                    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
                } else if (decoded.type === 'User' && pathname !== '/user-dashboard') {
                    return NextResponse.redirect(new URL('/user-dashboard', request.url));
                }
            } else {
                // Redirect to login if verification fails
                if (pathname !== '/login') {
                    return NextResponse.redirect(new URL('/login', request.url));
                }
            }
        } catch (error) {
            // Redirect to login if token verification fails due to error
            if (pathname !== '/login') {
                return NextResponse.redirect(new URL('/login', request.url));
            }
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/api/:path*', '/user-dashboard/:path*', '/admin/dashboard'],
};

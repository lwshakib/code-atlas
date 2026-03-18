import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface IndexingCompleteEmailProps {
  codebaseName: string;
  codebaseUrl: string;
}

export const IndexingCompleteEmail = ({
  codebaseName,
  codebaseUrl,
}: IndexingCompleteEmailProps) => (
  <Html>
    <Head />
    <Preview>Your codebase atlas for {codebaseName} is ready.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={h1}>Architecture Map Ready.</Heading>
        </Section>
        <Section style={contentSection}>
          <Text style={text}>
            Good news! We&apos;ve finished indexing <strong>{codebaseName}</strong>.
            Your architectural map, developer wiki, and agentic chat are now fully
            initialized and ready for exploration.
          </Text>
          <Button
            style={button}
            href={codebaseUrl}
          >
            Explore Codebase
          </Button>
        </Section>
        <Hr style={hr} />
        <Section style={footer}>
          <Text style={footerText}>
            This is an automated notification from Code Atlas. You can view all
            your indexed repositories at{" "}
            <Link href={`${new URL(codebaseUrl).origin}/codebase`} style={link}>
              your dashboard
            </Link>
            .
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default IndexingCompleteEmail;

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '580px',
};

const headerSection = {
  padding: '32px 0 24px',
};

const h1 = {
  color: '#000000',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.25',
  margin: '0',
  letterSpacing: '-0.05em',
};

const contentSection = {
  padding: '0 0 40px',
};

const text = {
  color: '#444444',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 24px',
};

const button = {
  backgroundColor: '#000000',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  width: 'fit-content',
  padding: '12px 24px',
};

const hr = {
  borderColor: '#eaeaea',
  margin: '20px 0',
};

const footer = {
  padding: '0 0 24px',
};

const footerText = {
  color: '#666666',
  fontSize: '12px',
  lineHeight: '24px',
};

const link = {
  color: '#000000',
  textDecoration: 'none',
};

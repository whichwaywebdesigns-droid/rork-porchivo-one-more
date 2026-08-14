import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, FileText, Mail, MapPin, Building2 } from 'lucide-react-native';
import Colors from '@/constants/colors';

const EFFECTIVE_DATE = 'August 14, 2026';

interface SectionProps {
  number: string;
  title: string;
  children: React.ReactNode;
}

function Section({ number, title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{number}. {title}</Text>
      {children}
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function SubHeading({ text }: { text: string }) {
  return <Text style={styles.subHeading}>{text}</Text>;
}

export default function TermsOfServiceScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Terms of Service',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={{ marginRight: 8 }}>
              <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <FileText size={28} color={Colors.white} />
          </View>
          <Text style={styles.headerTitle}>Terms of Service</Text>
          <Text style={styles.headerSubtitle}>Effective Date: {EFFECTIVE_DATE}</Text>
        </View>

        <View style={styles.introCard}>
          <Text style={styles.introText}>
            Welcome to <Text style={styles.bold}>Porchivo</Text>, a community management platform developed and operated by{' '}
            <Text style={styles.bold}>WhichWay Web Labs LLC</Text> ("Company," "we," "our," or "us"). These Terms of Service ("Terms") govern your access to and use of the Porchivo application ("App"), including all features, content, and services available through it.
          </Text>
          <Text style={[styles.introText, { marginTop: 10 }]}>
            By creating an account or using Porchivo, you agree to be bound by these Terms and our Privacy Policy. If you do not agree, do not download, install, or use the App.
          </Text>
        </View>

        <Section number="1" title="Eligibility">
          <Text style={styles.body}>
            You must be at least 18 years of age to create an account and use Porchivo. By using the App, you represent and warrant that you meet this age requirement and have the legal capacity to enter into these Terms. We do not knowingly allow users under 18 to register or use the App.
          </Text>
        </Section>

        <Section number="2" title="Account Registration">
          <Text style={styles.body}>
            To use Porchivo, you must create an account and provide accurate, current, and complete information including your name, email address, and phone number. You are responsible for:
          </Text>
          <Bullet text="Maintaining the confidentiality of your login credentials." />
          <Bullet text="All activity that occurs under your account." />
          <Bullet text="Promptly notifying us of any unauthorized access or use of your account." />
          <Text style={[styles.body, { marginTop: 8 }]}>
            We reserve the right to suspend or terminate accounts that contain false information or violate these Terms.
          </Text>
        </Section>

        <Section number="3" title="Description of Service">
          <Text style={styles.body}>
            Porchivo is a community management platform that helps homeowners associations, residents, board members, and property managers communicate, manage payments, handle maintenance requests, and access community documents. The App provides the following features:
          </Text>
          <Bullet text="Track Every Delivery: Log incoming packages, add tracking numbers, and receive real-time status updates." />
          <Bullet text="Neighborhood Watch: View anonymized delivery activity on your block in near real-time." />
          <Bullet text="Porch Partners: Coordinate with trusted neighbors who can hold packages on your behalf when you are away." />
          <Bullet text="Instant Alerts: Report and receive notifications about suspicious activity related to package safety in your neighborhood." />
          <Text style={[styles.body, { marginTop: 8 }]}>
            Users may select one of two roles upon sign-in: Homeowner or Porch Partner. Roles may be changed at any time within the App.
          </Text>
        </Section>

        <Section number="4" title="License to Use">
          <Text style={styles.body}>
            We grant you a limited, non-exclusive, non-transferable, revocable license to download, install, and use Porchivo on a compatible mobile device that you own or control, solely for your personal, non-commercial use in accordance with these Terms.
          </Text>
          <Text style={[styles.body, { marginTop: 8 }]}>This license does not grant you any right to:</Text>
          <Bullet text="Modify, reverse-engineer, decompile, or disassemble the App or any part of it." />
          <Bullet text="Reproduce, distribute, publicly display, or create derivative works from the App." />
          <Bullet text="Use the App for any commercial purpose without our prior written consent." />
          <Bullet text="Remove, alter, or obscure any copyright, trademark, or proprietary notices." />
        </Section>

        <Section number="5" title="User Conduct and Acceptable Use">
          <Text style={styles.body}>By using Porchivo, you agree to:</Text>
          <Bullet text="Use the App only for its intended purpose of neighborhood package protection and community safety." />
          <Bullet text="Provide truthful and accurate information in all package entries, alerts, and communications." />
          <Bullet text="Treat other users with respect and courtesy." />
          <Bullet text="Comply with all applicable local, state, and federal laws." />
        </Section>

        <Section number="6" title="Prohibited Activities">
          <Text style={styles.body}>You agree not to:</Text>
          <Bullet text="Submit false, misleading, or malicious Instant Alert reports." />
          <Bullet text="Use the App to harass, stalk, threaten, or intimidate any person." />
          <Bullet text="Impersonate another person or misrepresent your identity or role." />
          <Bullet text="Intercept, tamper with, or steal packages belonging to others." />
          <Bullet text="Use the App to facilitate any illegal activity." />
          <Bullet text="Collect personal information about other users without their consent." />
          <Bullet text="Attempt to gain unauthorized access to the App, its servers, or other users' accounts." />
          <Bullet text="Upload viruses, malware, or any harmful code." />
          <Bullet text="Spam, solicit, or send unsolicited communications to other users." />
          <Bullet text="Use automated bots, scrapers, or similar tools to access the App." />
          <View style={styles.highlightBox}>
            <Text style={styles.highlightText}>
              Violation of these rules may result in immediate suspension or permanent termination of your account at our sole discretion.
            </Text>
          </View>
        </Section>

        <Section number="7" title="User-Generated Content">
          <Text style={styles.body}>
            Porchivo allows you to submit content including package descriptions, Instant Alert reports, photos, and text descriptions ("User Content"). By submitting User Content, you:
          </Text>
          <Bullet text="Retain ownership of your original content." />
          <Bullet text="Grant WhichWay Web Labs LLC a worldwide, royalty-free, non-exclusive license to use, display, reproduce, and distribute your User Content solely for the purpose of operating and improving the App." />
          <Bullet text="Represent and warrant that your User Content does not violate any third party's rights, including intellectual property, privacy, or publicity rights." />
          <Bullet text="Acknowledge that User Content submitted through Instant Alerts will be shared in anonymized form with nearby opted-in users." />
          <Text style={[styles.body, { marginTop: 8 }]}>
            We reserve the right to remove any User Content that violates these Terms or that we deem inappropriate, without prior notice.
          </Text>
        </Section>

        <Section number="8" title="Porch Partner Program Disclaimer">
          <SubHeading text="a. What the Porch Partner Feature Is" />
          <Text style={styles.body}>
            The Porch Partner feature allows a Porchivo resident ("Requesting Resident") to designate a fellow neighbor who is also a Porchivo user ("Porch Partner") to temporarily receive and hold a package on their behalf until the Requesting Resident is available to retrieve it. This feature exists to help residents reduce the risk of package theft, commonly known as porch piracy.
          </Text>

          <SubHeading text="b. Porchivo's Role Is Limited to the Platform" />
          <Text style={styles.body}>
            Porchivo provides the technology that connects Requesting Residents with their chosen Porch Partners. Porchivo is not a party to the arrangement between a Requesting Resident and their Porch Partner. Porchivo does not:
          </Text>
          <Bullet text="Select, screen, background check, verify, or vet any Porch Partner" />
          <Bullet text="Supervise, monitor, or control the actions of any Porch Partner" />
          <Bullet text="Inspect, handle, store, or take custody of any package at any time" />
          <Bullet text="Guarantee that a Porch Partner will be available, reliable, or responsible" />
          <Bullet text="Insure or reimburse any user for lost, damaged, opened, stolen, or mishandled packages" />

          <SubHeading text="c. The Porch Partner Relationship Is Between Neighbors" />
          <Text style={styles.body}>
            The arrangement between a Requesting Resident and a Porch Partner is a voluntary, neighbor-to-neighbor agreement. By using the Porch Partner feature, both the Requesting Resident and the Porch Partner agree that:
          </Text>
          <Bullet text="Porchivo bears no responsibility for what happens to a package once it is in the possession of, or on the property of, a Porch Partner." />
          <Bullet text="The Porch Partner is not an employee, agent, or contractor of Porchivo in any capacity. Porch Partners act entirely on their own and on behalf of their neighbor — not on behalf of Porchivo." />
          <Bullet text="Any dispute over a package — including loss, damage, theft, delay in return, or any other issue — is solely between the Requesting Resident and the Porch Partner, and must be resolved between those parties directly." />
          <Bullet text="Porchivo is not liable for any loss, damage, or harm arising from the Porch Partner arrangement, including property damage, personal injury, theft, or any other claim." />

          <SubHeading text="d. Requesting Residents Acknowledge" />
          <Text style={styles.body}>By requesting a Porch Partner through Porchivo, you acknowledge and agree that:</Text>
          <Bullet text="You are choosing your Porch Partner voluntarily and at your own risk" />
          <Bullet text="You are responsible for communicating clearly with your Porch Partner about pickup timing and instructions" />
          <Bullet text="Porchivo has not vetted or approved your Porch Partner's suitability to hold your package" />
          <Bullet text="If your package is lost, damaged, or not returned, your recourse is with your Porch Partner and/or your carrier or supplier — not with Porchivo" />
          <Bullet text="Porchivo is not responsible for and will not reimburse the value of any package" />

          <SubHeading text="e. Porch Partners Acknowledge" />
          <Text style={styles.body}>By agreeing to serve as a Porch Partner through Porchivo, you acknowledge and agree that:</Text>
          <Bullet text="You are voluntarily accepting temporary responsibility for another resident's package" />
          <Bullet text="You will handle the package with reasonable care and return it to the Requesting Resident promptly" />
          <Bullet text="You will not open, use, damage, or fail to return any package entrusted to you" />
          <Bullet text="Any failure to return or any damage to a package may expose you to civil liability with the Requesting Resident" />
          <Bullet text="Porchivo is not responsible for any dispute that arises from your role as a Porch Partner" />

          <SubHeading text="f. Boards and Property Managers Acknowledge" />
          <Text style={styles.body}>
            HOA boards and property managers who enable the Porch Partner feature for their community acknowledge that:
          </Text>
          <Bullet text="Porchivo provides the Porch Partner feature as a platform tool only" />
          <Bullet text="Enabling this feature does not make the HOA, association, or property management company liable for package arrangements between residents" />
          <Bullet text="Porchivo is not responsible for any community-level disputes that arise from Porch Partner use" />
        </Section>

        <Section number="9" title="No Vetting, Background Checks, or Endorsement">
          <View style={styles.legalNote}>
            <Text style={styles.legalNoteText}>
              PORCHIVO DOES NOT VET, SCREEN, BACKGROUND-CHECK, IDENTITY-VERIFY, OR OTHERWISE INVESTIGATE ANY USER, HOMEOWNER, PORCH PARTNER, NEIGHBOR, OR THIRD PARTY.
            </Text>
          </View>
          <Text style={[styles.body, { marginTop: 12 }]}>
            Porchivo is a neutral coordination and information platform that connects neighbors. We do not employ, supervise, direct, or control any user, and no user is our agent, employee, partner, or representative. Specifically, you acknowledge and agree that:
          </Text>
          <Bullet text="We do not conduct criminal, identity, credit, reference, or other background checks on any user, and any optional verification badge a user may obtain does not constitute a guarantee, endorsement, or warranty by us as to that person's identity, trustworthiness, character, or fitness." />
          <Bullet text="We make no representation or warranty regarding the conduct, reliability, honesty, or suitability of any Homeowner, Porch Partner, or other user." />
          <Bullet text="You are solely responsible for deciding whether to interact with, share information with, hand packages to, or allow access to any other user, and for taking your own precautions." />
          <Bullet text="Listing, matching, or appearing in the App is not an endorsement or recommendation of any user by WhichWay Web Labs LLC." />
        </Section>

        <Section number="10" title="Assumption of Risk; Personal Injury and Bodily Harm">
          <View style={styles.legalNote}>
            <Text style={styles.legalNoteText}>
              YOU USE PORCHIVO AND PARTICIPATE IN ANY NEIGHBOR-TO-NEIGHBOR ARRANGEMENT ENTIRELY AT YOUR OWN RISK. WHICHWAY WEB LABS LLC IS NOT RESPONSIBLE OR LIABLE FOR ANY BODILY INJURY, PERSONAL INJURY, EMOTIONAL DISTRESS, ILLNESS, DEATH, OR PROPERTY DAMAGE ARISING OUT OF OR RELATED TO YOUR USE OF THE APP OR YOUR INTERACTIONS WITH OTHER USERS.
            </Text>
          </View>
          <Text style={[styles.body, { marginTop: 12 }]}>
            Porchivo facilitates in-person, real-world interactions between neighbors, including package hand-offs, meetups, and entering or approaching another person's property. By using the App, you knowingly and voluntarily assume all risks associated with those interactions, including but not limited to:
          </Text>
          <Bullet text="Physical injury, assault, harassment, theft, or property damage caused by another user or third party." />
          <Bullet text="Slips, falls, accidents, animal encounters, or other hazards on any property you visit or where a hand-off occurs." />
          <Bullet text="Any dispute, altercation, or harm that arises before, during, or after a Porch Partner arrangement or any other coordinated activity." />
          <Text style={[styles.body, { marginTop: 8 }]}>
            To the maximum extent permitted by law, you release and discharge WhichWay Web Labs LLC and its officers, directors, employees, and agents from any and all claims, demands, damages, and liabilities of every kind — whether for bodily injury, personal injury, death, or property loss or damage — arising out of or in any way connected with your use of the App or your interactions with other users. You are encouraged to meet in safe locations, take reasonable safety precautions, and contact local law enforcement (call 911) in any emergency.
          </Text>
        </Section>

        <Section number="11" title="Instant Alerts Disclaimer">
          <Text style={styles.body}>
            The Instant Alerts feature allows users to share neighbor-to-neighbor tips about suspicious activity on their block. Instant Alerts are not police reports, emergency services, or official crime reports. By using this feature, you understand that:
          </Text>
          <Bullet text="You should contact local law enforcement (call 911) for any emergency or crime in progress." />
          <Bullet text="WhichWay Web Labs LLC does not verify the accuracy of user-submitted alerts." />
          <Bullet text="You are solely responsible for the content and accuracy of any alert you submit." />
          <Bullet text="Submitting knowingly false reports may result in account termination and may violate applicable laws." />
        </Section>

        <Section number="12" title="No Affiliation With Carriers or Suppliers">
          <Text style={styles.body}>
            Porchivo is a community management platform. We are not a shipping carrier, delivery service, retailer, or product supplier. Porchivo is not affiliated with, endorsed by, or partnered with any carrier or supplier, including but not limited to UPS, FedEx, USPS, Amazon, DHL, OnTrac, or any other delivery or retail company.
          </Text>
          <Text style={styles.body}>
            Any package delivery information entered into or tracked through Porchivo — including expected deliveries, delivery notifications, or delivery status updates — is provided by the user for personal organizational purposes only. Porchivo does not verify, guarantee, or take responsibility for:
          </Text>
          <Bullet text="The accuracy of any delivery information entered by users" />
          <Bullet text="The timing, condition, or completion of any delivery" />
          <Bullet text="Any item lost, stolen, damaged, delayed, or misdelivered by a carrier or supplier" />
          <Bullet text="Any dispute between a user and a carrier or supplier regarding an order or delivery" />
          <View style={styles.highlightBox}>
            <Text style={styles.highlightText}>
              If you have a question, concern, or dispute about a delivery, order, or product, you must contact the carrier or supplier directly. Porchivo cannot intervene in, escalate, or resolve disputes with third-party carriers or suppliers on your behalf.
            </Text>
          </View>
          <Text style={[styles.body, { marginTop: 8 }]}>
            This disclaimer applies to all Porchivo account holders and users in every role, including but not limited to: Homeowners and residents, HOA board members, Condominium association members, Multi-unit community residents, Property managers, and Porch Partners.
          </Text>
        </Section>

        <Section number="13" title="Intellectual Property">
          <Text style={styles.body}>
            All rights, title, and interest in and to the Porchivo App, including its design, logos, "Porchivo" name, the slogan "When porch pirates lurk, neighbors go to work," graphics, software, and all related intellectual property, are owned by WhichWay Web Labs LLC and are protected by United States and international copyright, trademark, and other intellectual property laws.
          </Text>
          <Text style={[styles.body, { marginTop: 8 }]}>
            You may not use our trademarks, trade names, or branding without our prior written permission.
          </Text>
        </Section>

        <Section number="14" title="Privacy">
          <Text style={styles.body}>
            Your use of Porchivo is also governed by our Privacy Policy, which describes how we collect, use, share, and protect your information. By using the App, you consent to the practices described in the Privacy Policy. The Privacy Policy is incorporated into these Terms by reference.
          </Text>
        </Section>

        <Section number="15" title="Third-Party Services">
          <Text style={styles.body}>
            The App may contain links to or integrations with third-party services, including but not limited to mapping services and carrier tracking APIs. These third-party services are governed by their own terms and privacy policies. WhichWay Web Labs LLC is not responsible for the content, accuracy, or practices of any third-party service.
          </Text>
        </Section>

        <Section number="16" title="Disclaimers">
          <View style={styles.legalNote}>
            <Text style={styles.legalNoteText}>
              THE APP IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </Text>
          </View>
          <Text style={[styles.body, { marginTop: 12 }]}>We do not warrant that:</Text>
          <Bullet text="The App will be uninterrupted, error-free, or secure." />
          <Bullet text="Package tracking information will be accurate or up to date. Tracking data originates from third-party carriers; for any missing, lost, or damaged package you must contact the carrier directly, as they are responsible for resolution." />
          <Bullet text="Instant Alerts or Neighborhood Watch activity reflects verified or accurate information." />
          <Bullet text="The App will meet your specific requirements." />
        </Section>

        <Section number="17" title="Limitation of Liability">
          <View style={styles.legalNote}>
            <Text style={styles.legalNoteText}>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, PORCHIVO SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO:
            </Text>
            <Bullet text="ANY DELIVERY, NON-DELIVERY, OR CONDITION OF ANY PACKAGE OR ORDER" />
            <Bullet text="ANY ACTION OR INACTION OF A CARRIER, SUPPLIER, OR PORCH PARTNER" />
            <Bullet text="ANY LOSS, THEFT, OR DAMAGE TO PROPERTY IN CONNECTION WITH THE PORCH PARTNER FEATURE" />
            <Bullet text="ANY DISPUTE BETWEEN USERS RELATED TO PACKAGE HANDLING" />
            <Text style={[styles.legalNoteText, { marginTop: 8 }]}>
              THIS LIMITATION APPLIES REGARDLESS OF WHETHER PORCHIVO HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES AND REGARDLESS OF THE LEGAL THEORY UNDER WHICH DAMAGES ARE SOUGHT.
            </Text>
            <Text style={[styles.legalNoteText, { marginTop: 8 }]}>
              IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR $100 USD, WHICHEVER IS GREATER.
            </Text>
          </View>
        </Section>

        <Section number="18" title="Indemnification">
          <Text style={styles.body}>
            By using Porchivo's Porch Partner feature — whether as a Requesting Resident or as a Porch Partner — you agree to indemnify, defend, and hold harmless Porchivo, its officers, employees, and agents from and against any claims, damages, losses, liabilities, costs, or expenses (including reasonable attorneys' fees) arising out of or related to your participation in a Porch Partner arrangement.
          </Text>
          <Text style={[styles.body, { marginTop: 8 }]}>
            You also agree to defend, indemnify, and hold harmless WhichWay Web Labs LLC and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable attorneys' fees) arising out of or related to:
          </Text>
          <Bullet text="Your use or misuse of the App." />
          <Bullet text="Your User Content." />
          <Bullet text="Your violation of these Terms." />
          <Bullet text="Your violation of any rights of a third party." />
          <Bullet text="Any package loss, damage, or theft occurring during a Porch Partner arrangement." />
        </Section>

        <Section number="19" title="No Guarantee Against Porch Piracy">
          <Text style={styles.body}>
            The Porch Partner feature is designed to help reduce the risk of package theft. However, Porchivo does not guarantee that use of the Porch Partner feature will prevent theft, loss, or damage to any package. Porchivo makes no warranty, express or implied, regarding the effectiveness of this feature in preventing porch piracy or any other form of package loss.
          </Text>
        </Section>

        <Section number="20" title="Account Termination">
          <Text style={styles.body}>
            We may suspend or terminate your account at any time, with or without notice, for conduct that we believe violates these Terms, is harmful to other users, or is otherwise objectionable.
          </Text>
          <Text style={[styles.body, { marginTop: 8 }]}>
            You may delete your account at any time through Settings → Account → Delete Account. Your account will be deactivated immediately and your personal data will be permanently deleted within 30 days. You may contact us within the 30-day window to restore your account. Upon deletion, your personal data will be handled in accordance with our Privacy Policy.
          </Text>
        </Section>

        <Section number="21" title="Governing Law and Dispute Resolution">
          <Text style={styles.body}>
            These Terms shall be governed by and construed in accordance with the laws of the State of Indiana, United States, without regard to its conflict of law provisions.
          </Text>
          <Text style={[styles.body, { marginTop: 8 }]}>
            Any dispute arising out of or relating to these Terms or the App shall first be attempted to be resolved through good-faith negotiation. If unresolved within thirty (30) days, either party may pursue binding arbitration administered in Indianapolis, Indiana, in accordance with the rules of the American Arbitration Association. You agree to waive any right to a jury trial or to participate in a class action lawsuit.
          </Text>
        </Section>

        <Section number="22" title="Changes to These Terms">
          <Text style={styles.body}>
            We reserve the right to modify these Terms at any time. When we make material changes, we will notify you through the App or by email and update the "Effective Date" at the top of this document. Your continued use of Porchivo after changes are posted constitutes acceptance of the revised Terms. If you do not agree with the changes, you must stop using the App and delete your account.
          </Text>
        </Section>

        <Section number="23" title="Severability">
          <Text style={styles.body}>
            If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.
          </Text>
        </Section>

        <Section number="24" title="Entire Agreement">
          <Text style={styles.body}>
            These Terms, together with the Privacy Policy and any other legal documents referenced herein, constitute the entire agreement between you and WhichWay Web Labs LLC regarding your use of Porchivo and supersede all prior agreements and understandings.
          </Text>
        </Section>

        <Section number="25" title="Where to Direct Concerns">
          <Text style={styles.body}>
            If you are unsure who to contact about a specific issue, use the following guide:
          </Text>
          <View style={styles.providerTable}>
            <View style={styles.providerRow}>
              <Text style={styles.providerName}>Package not delivered / delayed</Text>
              <Text style={styles.providerPurpose}>Your carrier (UPS, FedEx, USPS, etc.)</Text>
            </View>
            <View style={styles.providerRow}>
              <Text style={styles.providerName}>Wrong item / damaged item</Text>
              <Text style={styles.providerPurpose}>Your supplier or retailer</Text>
            </View>
            <View style={styles.providerRow}>
              <Text style={styles.providerName}>Porch Partner dispute</Text>
              <Text style={styles.providerPurpose}>Resolve directly with your neighbor</Text>
            </View>
            <View style={styles.providerRow}>
              <Text style={styles.providerName}>HOA community concerns</Text>
              <Text style={styles.providerPurpose}>Your HOA board or property manager</Text>
            </View>
            <View style={styles.providerRow}>
              <Text style={styles.providerName}>Porchivo platform issues</Text>
              <Text style={styles.providerPurpose}>support@porchivo.com</Text>
            </View>
          </View>
        </Section>

        <Section number="26" title="Contact Us">
          <Text style={styles.body}>
            If you have questions or concerns about these Terms, please contact us at:
          </Text>
          <View style={styles.contactCard}>
            <View style={styles.contactRow}>
              <Building2 size={16} color={Colors.primary} />
              <Text style={styles.contactText}>WhichWay Web Labs LLC</Text>
            </View>
            <View style={styles.contactRow}>
              <Mail size={16} color={Colors.primary} />
              <Text style={styles.contactText}>support@porchivo.com</Text>
            </View>
            <View style={styles.contactRow}>
              <MapPin size={16} color={Colors.primary} />
              <Text style={styles.contactText}>Indianapolis, Indiana, United States</Text>
            </View>
          </View>
        </Section>

        <View style={styles.legalNotice}>
          <Text style={styles.legalNoteText}>
            <Text style={styles.bold}>Legal Notice:</Text> This disclaimer was drafted to reflect Porchivo's known platform structure and features as of the effective date. Given that the Porch Partner feature involves one user taking physical custody of another user's property, it is strongly recommended that a licensed attorney review these Terms before the Porch Partner feature is made publicly available. Liability exposure in user-to-user physical property arrangements can vary significantly by state.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2026 WhichWay Web Labs LLC. All rights reserved.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: Colors.white,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.slate,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.slateLight,
  },
  introCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
  },
  introText: {
    fontSize: 14,
    color: Colors.slateLight,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700' as const,
    color: Colors.slate,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: 12,
  },
  subHeading: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.slate,
    marginTop: 12,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: Colors.slateLight,
    lineHeight: 22,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    paddingRight: 8,
    marginBottom: 6,
  },
  bulletDot: {
    fontSize: 14,
    color: Colors.primary,
    marginRight: 8,
    marginTop: 1,
    fontWeight: '700' as const,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: Colors.slateLight,
    lineHeight: 21,
  },
  highlightBox: {
    backgroundColor: Colors.dangerLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
  },
  highlightText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.danger,
  },
  legalNote: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
  },
  legalNoteText: {
    fontSize: 13,
    color: Colors.slateLight,
    lineHeight: 20,
  },
  providerTable: {
    marginTop: 10,
    backgroundColor: Colors.background,
    borderRadius: 10,
    overflow: 'hidden',
  },
  providerRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border || '#E5E7EB',
    gap: 10,
  },
  providerName: {
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.slate,
    width: 150,
  },
  providerPurpose: {
    flex: 1,
    fontSize: 13,
    color: Colors.slateLight,
    lineHeight: 19,
  },
  legalNotice: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 14,
  },
  contactCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginTop: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contactText: {
    fontSize: 14,
    color: Colors.slate,
    flex: 1,
  },
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: Colors.slateLighter,
  },
});
